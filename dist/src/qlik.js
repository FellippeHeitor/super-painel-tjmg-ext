const HOST = 'qlik.tjmg.jus.br';
const ORIGEM = `https://${HOST}`;
const TENTATIVAS_EXTRA = 2;
const LIMITE_WS_MS = 60000;
const FOLGA_JOB_MS = 30000; // além do timeout do próprio job (o engine encerra sozinho no timeout)
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
export const urlQlik = (appid, sheet) => `https://${HOST}/single/?appid=${appid}&sheet=${sheet}&opt=ctxmenu,currsel`;
// Iframe de trabalho único, reaproveitado entre painéis. Some no fim da rotina.
export class Navegador {
    frame = null;
    appid = null;
    ws = null;
    seq = 0;
    pendentes = new Map();
    ouvinte = (e) => {
        if (!this.frame || e.source !== this.frame.contentWindow || e.origin !== ORIGEM)
            return;
        const m = e.data;
        if (!m || m.superPainel !== 1)
            return;
        const r = this.pendentes.get(m.id);
        if (r) {
            this.pendentes.delete(m.id);
            r(m.resposta);
        }
    };
    // Pergunta ao engine.ts dentro do iframe. undefined se não respondeu em limiteMs (página ainda carregando ou navegando).
    pedir(msg, limiteMs) {
        const alvo = this.frame && this.frame.contentWindow;
        if (!alvo)
            return Promise.resolve(undefined);
        const id = ++this.seq;
        return new Promise((resolve) => {
            const t = setTimeout(() => { this.pendentes.delete(id); resolve(undefined); }, limiteMs);
            this.pendentes.set(id, (r) => { clearTimeout(t); resolve(r); });
            alvo.postMessage({ superPainel: 1, id, ...msg }, ORIGEM); // origem fixa: se o iframe não estiver no Qlik, a mensagem não é entregue
        });
    }
    async esperarWs(appid, limiteMs) {
        const fim = Date.now() + limiteMs;
        while (Date.now() < fim) {
            const u = await this.pedir({ tipo: 'ws', appid }, 1000);
            if (u)
                return u;
            await espera(500);
        }
        return null;
    }
    removerFrame() {
        if (this.frame)
            this.frame.remove();
        this.frame = null;
        for (const r of this.pendentes.values())
            r(undefined);
        this.pendentes.clear();
    }
    // Sempre um iframe novo (troca de app ou nova tentativa): página limpa, sem URLs de WebSocket antigas.
    async _abrir(appid, sheet) {
        this.removerFrame();
        window.addEventListener('message', this.ouvinte); // mesmo ouvinte: adicionar de novo não duplica
        const f = document.createElement('iframe');
        // fora da tela, mas com tamanho real (o Qlik monta a sheet normalmente); nunca recebe foco
        f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:800px;border:0;pointer-events:none';
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        f.title = 'Qlik (coleta)';
        f.src = urlQlik(appid, sheet);
        document.body.append(f);
        this.frame = f;
        this.ws = await this.esperarWs(appid, LIMITE_WS_MS);
        if (!this.ws && (await this.pedir({ tipo: 'dialogo' }, 2000)))
            this.ws = await this.esperarWs(appid, LIMITE_WS_MS);
        this.appid = this.ws ? appid : null;
        if (!this.ws)
            throw new Error('O Qlik não abriu a conexão em ' + LIMITE_WS_MS / 1000 + ' s (sem acesso ao qlik.tjmg.jus.br?)');
    }
    // Roda um job no app do painel. Devolve {resultado, tentativas}; resultado tem 'erro' se todas as tentativas falharam.
    async executar(painel, job, sheet) {
        const folha = sheet || job.sheet || painel.sheet;
        const total = 1 + TENTATIVAS_EXTRA;
        let ultimo = { erro: 'nao executado' };
        for (let tent = 1; tent <= total; tent++) {
            try {
                if (this.appid !== painel.appid || tent > 1)
                    await this._abrir(painel.appid, folha);
                const j = Object.assign({ timeout_ms: 240000 }, job, { sheet: folha });
                ultimo = (await this.pedir({ tipo: 'job', ws: this.ws, job: j }, j.timeout_ms + FOLGA_JOB_MS)) || { erro: 'sem resposta da página do Qlik' };
                if (!('erro' in ultimo) && (await this.pedir({ tipo: 'dialogo' }, 2000)))
                    ultimo = { erro: 'conexao_perdida' };
            }
            catch (e) {
                ultimo = { erro: String(e.message || e).slice(0, 300) };
                this.appid = null;
            }
            if (!('erro' in ultimo))
                return { resultado: ultimo, tentativas: tent };
            console.warn(`${painel.id}: tentativa ${tent}/${total} falhou (${ultimo.erro})`);
            this.appid = null; // força recriar o iframe na próxima tentativa
        }
        return { resultado: ultimo, tentativas: total };
    }
    async fechar() {
        this.removerFrame();
        window.removeEventListener('message', this.ouvinte);
        this.appid = null;
        this.ws = null;
    }
}
