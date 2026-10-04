// Execução de jobs na Engine API do Qlik a partir da extensão. Equivale ao app/qlik.py do robô (Playwright):
// uma aba de trabalho em segundo plano abre o app do painel; gancho-ws.ts anota a URL do WebSocket da Engine
// (com o qlik-csrf-token da sessão anônima) e o engine.ts roda dentro da aba, no contexto da página.
// Falha / "Conexão perdida" => recarrega a aba e repete (no máx. TENTATIVAS_EXTRA vezes), como no robô.
import { engine } from './engine.js';
const HOST = 'qlik.tjmg.jus.br';
const TENTATIVAS_EXTRA = 2;
const LIMITE_WS_MS = 60000;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
export const urlQlik = (appid, sheet) => `https://${HOST}/single/?appid=${appid}&sheet=${sheet}&opt=ctxmenu,currsel`;
async function emMain(tabId, func, args) {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args: (args || []) });
    return r ? r.result : undefined;
}
// espera a aba terminar de carregar (depois de update/reload)
function esperarCarregar(tabId, limiteMs) {
    return new Promise((resolve) => {
        let viuLoading = false;
        const fim = setTimeout(() => { chrome.tabs.onUpdated.removeListener(ouvir); resolve(false); }, limiteMs);
        function ouvir(id, info) {
            if (id !== tabId)
                return;
            if (info.status === 'loading')
                viuLoading = true;
            if (info.status === 'complete' && viuLoading) {
                clearTimeout(fim);
                chrome.tabs.onUpdated.removeListener(ouvir);
                resolve(true);
            }
        }
        chrome.tabs.onUpdated.addListener(ouvir);
    });
}
async function esperarWs(tabId, appid, limiteMs) {
    const fim = Date.now() + limiteMs;
    while (Date.now() < fim) {
        try {
            const urls = await emMain(tabId, () => window.__superPainelWs || []);
            const u = (urls || []).find((x) => x.includes('/app/' + appid));
            if (u)
                return u;
        }
        catch (e) { /* aba ainda navegando */ }
        await espera(500);
    }
    return null;
}
// Diálogo "Conexão perdida... atualizar para continuar": clica em "Atualizar". true se clicou.
function tratarDialogoNaPagina() {
    const texto = document.body ? document.body.innerText : '';
    if (!/conex[ãa]o perdida|connection lost|atualizar para continuar/i.test(texto))
        return false;
    const bt = [...document.querySelectorAll('button')].find((b) => /^\s*(atualizar|refresh)\s*$/i.test(b.textContent || ''));
    if (bt) {
        bt.click();
        return true;
    }
    return false;
}
// Aba de trabalho única, reaproveitada entre painéis. Fecha no fim da rotina.
export class Navegador {
    tabId = null;
    appid = null;
    ws = null;
    async _abrir(appid, sheet, recarregar) {
        const url = urlQlik(appid, sheet);
        if (this.tabId != null) {
            try {
                await chrome.tabs.get(this.tabId);
            }
            catch (e) {
                this.tabId = null;
            }
        }
        if (this.tabId == null) {
            const aba = await chrome.tabs.create({ url, active: false }); // aba nova: só aguarda o WebSocket abaixo
            this.tabId = aba.id ?? null;
            if (this.tabId == null)
                throw new Error('não foi possível abrir a aba do Qlik');
        }
        else {
            try {
                await emMain(this.tabId, () => { if (window.__superPainelWs)
                    window.__superPainelWs.length = 0; });
            }
            catch (e) { /* nada */ }
            const carregou = esperarCarregar(this.tabId, LIMITE_WS_MS);
            if (recarregar)
                await chrome.tabs.reload(this.tabId);
            else
                await chrome.tabs.update(this.tabId, { url });
            await carregou;
        }
        const tabId = this.tabId;
        this.ws = await esperarWs(tabId, appid, LIMITE_WS_MS);
        if (!this.ws) {
            try {
                if (await emMain(tabId, tratarDialogoNaPagina))
                    this.ws = await esperarWs(tabId, appid, LIMITE_WS_MS);
            }
            catch (e) { /* nada */ }
        }
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
                    await this._abrir(painel.appid, folha, tent > 1 && this.appid === painel.appid);
                ultimo = (await emMain(this.tabId, engine, [[this.ws, Object.assign({ timeout_ms: 240000 }, job, { sheet: folha })]])) || { erro: 'sem resposta da página do Qlik' };
                if (!('erro' in ultimo) && (await emMain(this.tabId, tratarDialogoNaPagina)))
                    ultimo = { erro: 'conexao_perdida' };
            }
            catch (e) {
                ultimo = { erro: String(e.message || e).slice(0, 300) };
                this.appid = null;
            }
            if (!('erro' in ultimo))
                return { resultado: ultimo, tentativas: tent };
            console.warn(`${painel.id}: tentativa ${tent}/${total} falhou (${ultimo.erro})`);
            this.appid = null; // força recarregar na próxima tentativa
        }
        return { resultado: ultimo, tentativas: total };
    }
    async fechar() {
        if (this.tabId != null)
            await chrome.tabs.remove(this.tabId).catch(() => { });
        this.tabId = null;
        this.appid = null;
        this.ws = null;
    }
}
