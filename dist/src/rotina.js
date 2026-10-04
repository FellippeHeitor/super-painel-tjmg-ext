// Rotina de coleta (equivale a `python -m app diario`): painéis devidos + conclusões + listas + Apoio sem duplicidade.
// Roda numa página da extensão (pages/coleta.html), que mostra o progresso. Uma rotina por vez (trava em chrome.storage.session).
import * as db from './db.js';
import { paineis as carregarPaineis, prefs } from './config.js';
import { Navegador } from './qlik.js';
import { coletarPainel } from './coleta.js';
import * as conclusoes from './conclusoes.js';
import * as listas from './listas.js';
const TRAVA = 'rotinaEmAndamento';
const TRAVA_MAX_MS = 45 * 60 * 1000; // trava abandonada (aba fechada no meio) expira
// Quais painéis coletar hoje, conforme a frequência (diaria | semanal | mensal | mensal_dia15). Porte de app/devidos.py.
export async function devidos(paineis, hoje = new Date()) {
    const ids = [];
    const diaIso = (d) => d.toISOString().slice(0, 10);
    for (const [pid, p] of Object.entries(paineis)) {
        if (pid === 'conclusoes_pje')
            continue; // coletado pelo módulo de conclusões
        const ult = await db.ultimaOk(pid);
        const dUlt = ult ? new Date(ult.iniciada) : null;
        const dias = dUlt ? (hoje.getTime() - dUlt.getTime()) / 864e5 : Infinity;
        const freq = p.frequencia || 'diaria';
        if (freq === 'semanal' || freq === 'mensal') {
            if (dias >= 7)
                ids.push(pid);
        }
        else if (freq === 'mensal_dia15') {
            const dia15 = new Date(hoje.getFullYear(), hoje.getMonth(), 15);
            if (!dUlt || (hoje.getDate() >= 15 && diaIso(dUlt) < diaIso(dia15)))
                ids.push(pid);
        }
        else
            ids.push(pid);
    }
    return ids;
}
export async function emAndamento() {
    const t = (await chrome.storage.session.get(TRAVA))[TRAVA];
    return t && Date.now() - t < TRAVA_MAX_MS ? t : null;
}
// log(texto, nível) recebe o progresso. opcoes: {todos: true} ignora as frequências; {paineis: [ids]} só esses.
export async function executar(log = () => { }, opcoes = {}) {
    if (await emAndamento()) {
        log('Já há uma coleta em andamento (outra aba). Aguarde ela terminar.', 'erro');
        return { codigo: 2 };
    }
    await chrome.storage.session.set({ [TRAVA]: Date.now() });
    const { comarca } = await prefs();
    const nav = new Navegador();
    let falhas = 0;
    try {
        if (!comarca)
            throw new Error('Escolha a comarca antes de coletar.');
        const paineis = await carregarPaineis();
        const ids = opcoes.paineis || (opcoes.todos ? Object.keys(paineis).filter((p) => p !== 'conclusoes_pje') : await devidos(paineis));
        log(`Comarca: ${comarca}. Painéis desta coleta: ${ids.length}.`);
        for (const pid of ids) {
            const p = paineis[pid];
            log(`Coletando ${p.nome}…`);
            await chrome.storage.session.set({ [TRAVA]: Date.now() });
            const { rec, tabela } = await coletarPainel(nav, p, comarca);
            const n = rec.status !== 'FALHA' ? await listas.gravarDoPainel(pid, tabela) : null;
            log(`${p.nome}: ${rec.status}${n != null ? ` · ${n} processos na relação` : ''}${rec.erro ? ' · ' + rec.erro : ''}`, rec.status === 'FALHA' ? 'erro' : rec.status === 'PARCIAL' ? 'aviso' : 'ok');
            if (rec.status === 'FALHA')
                falhas++;
        }
        if (!opcoes.paineis) {
            log('Coletando conclusões (PJe + eProc)…');
            for (const [rot, st, det] of await conclusoes.coletar(nav, paineis, comarca)) {
                log(`${rot}: ${st} · ${det}`, st === 'FALHA' ? 'erro' : st === 'PARCIAL' ? 'aviso' : 'ok');
                if (st === 'FALHA')
                    falhas++;
            }
        }
        if (ids.includes('apoio_planejamento')) { // painel mensal: listas do Apoio sem duplicidade junto
            log('Gerando as listas do Apoio ao planejamento (sem o que já está no painel diário)…');
            const r = await listas.gerarApoio(nav, paineis.apoio_planejamento, comarca);
            log(`Apoio: ${r.status} · mês de referência ${r.mes || '?'}${r.avisos.length ? ' · ' + r.avisos.join('; ') : ''}`, r.status === 'FALHA' ? 'erro' : r.status === 'PARCIAL' ? 'aviso' : 'ok');
        }
        const podadas = await db.podar();
        if (podadas)
            log(`${podadas} coletas antigas removidas (fica a última de cada dia).`);
        await chrome.storage.local.set({ ultimaRotina: { em: db.agora(), falhas } });
        log(falhas ? `Concluído com ${falhas} falha(s). O painel mostra o último dado bom de cada fonte.` : 'Concluído.', falhas ? 'aviso' : 'ok');
        return { codigo: falhas ? 1 : 0 };
    }
    catch (e) {
        log(String(e.message || e), 'erro');
        return { codigo: 1 };
    }
    finally {
        await nav.fechar();
        await chrome.storage.session.remove(TRAVA);
    }
}
