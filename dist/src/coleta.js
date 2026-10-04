// Coleta de um painel: monta o job a partir da config, resolve a comarca, executa, valida filtros e grava no IndexedDB.
// Porte de app/coleta.py do robô. Salvaguarda: filtro que não pegou => FALHA e nada é gravado (seriam números do estado inteiro).
import * as db from './db.js';
import { grafia } from './comarca.js';
import { ehErro } from './tipos.js';
export function montarJob(painel, selecoes, extra = []) {
    const itens = [];
    const c = painel.carimbo;
    if (c && typeof c === 'object' && c.expressao)
        itens.push({ nome: '__carimbo', tipo: 'cubo', dimensoes: [], medidas: [c.expressao] });
    else if (c && typeof c === 'object')
        itens.push({ ...c, nome: '__carimbo', tipo: 'valor' });
    for (const [nome, spec] of Object.entries(painel.kpis || {}))
        itens.push({ ...spec, nome: `kpi:${nome}`, tipo: 'valor' });
    for (const [nome, spec] of Object.entries(painel.series || {}))
        itens.push({ ...spec, nome: `serie:${nome}`, tipo: 'serie' });
    for (const [nome, spec] of Object.entries(painel.cubos_valor || {}))
        itens.push({ nome: `cubok:${nome}`, tipo: 'cubo', dimensoes: [], medidas: spec.medidas });
    for (const [nome, spec] of Object.entries(painel.textos || {}))
        itens.push({ ...spec, nome: `texto:${nome}`, tipo: 'prop' });
    for (const [nome, spec] of Object.entries(painel.exprs || {}))
        itens.push({ ...spec, nome: `exprs:${nome}`, tipo: 'exprs' });
    for (const [nome, spec] of Object.entries(painel.cubos_serie || {}))
        itens.push({ nome: `cuboserie:${nome}`, tipo: 'cubo', dimensoes: spec.dimensoes, medidas: spec.medidas });
    itens.push(...extra);
    // itens da mesma sub-aba ficam juntos (trocar variável obriga a reler a aba)
    const chaveVar = (i) => JSON.stringify(Object.fromEntries(Object.entries(i.variaveis || {}).sort()));
    itens.sort((a, b) => (chaveVar(a) < chaveVar(b) ? -1 : chaveVar(a) > chaveVar(b) ? 1 : 0));
    return {
        selecoes,
        dinamicos: (painel.filtros_dinamicos || []).map((f) => ({ campo: f.campo, tipo: 'ultimo' })),
        itens,
    };
}
const ruins = (res) => ('selecoes' in res ? res.selecoes : []).filter((s) => !s.ok);
// Copia os resultados do engine para rec.valores / rec.series. Devolve avisos.
export function gravarValores(rec, res, prefixo = '', opcionais = new Set()) {
    const avisos = [];
    for (const [nome, r] of Object.entries(res.itens || {})) {
        if (nome.startsWith('__') || ehErro(r)) {
            if (ehErro(r) && !nome.startsWith('__tabela'))
                avisos.push(`${nome}: ${r.erro}`);
            continue;
        }
        const i = nome.indexOf(':');
        const tipo = nome.slice(0, i), chave = prefixo + nome.slice(i + 1);
        if (tipo === 'texto')
            rec.valores[chave] = { texto: r.txt ?? null, numero: null };
        else if (tipo === 'exprs')
            (r.itens || []).forEach((e, k) => { rec.valores[`${chave}.${k}`] = { texto: (e.titulo ? e.titulo + '||' : '') + e.expr, numero: e.num ?? null }; });
        else if (tipo === 'cuboserie') {
            const linhas = r.linhas || [];
            const nd = linhas.length ? linhas[0].length - 1 : 0;
            rec.series[chave] = linhas.map((ln) => ({ rotulo: ln.slice(0, nd).map((c) => c.txt).join(' | '), texto: ln[nd].txt, numero: ln[nd].num }));
            if (!linhas.length)
                avisos.push(`${nome}: série vazia`);
        }
        else if (tipo === 'cubok') {
            const l = r.linhas;
            const c = l && l[0] && l[0][0] ? l[0][0] : { txt: null, num: null };
            rec.valores[chave] = { texto: c.txt ?? null, numero: c.num ?? null };
        }
        else if (tipo === 'kpi')
            rec.valores[chave] = { texto: r.txt ?? null, numero: r.num ?? null };
        else if (tipo === 'serie') {
            const s = r;
            if (!s.linhas.length && !opcionais.has(nome))
                avisos.push(`${nome}: série vazia (0 linhas com os filtros atuais)`);
            rec.series[chave] = s.linhas.map((ln) => ({ rotulo: ln.r.join(' | '), texto: ln.v.txt, numero: ln.v.num }));
        }
    }
    return avisos;
}
export function novaColeta(painelId) {
    return { painel: painelId, iniciada: db.agora(), status: 'EM_ANDAMENTO', tentativas: 0, carimbo: null, selecoes: null, erro: null, valores: {}, series: {} };
}
async function finalizar(rec, status, extra) {
    Object.assign(rec, extra, { status, finalizada: db.agora() });
    rec.id = await db.gravarColeta(rec);
    return rec;
}
// Executa um job já com a comarca resolvida; se o filtro da comarca não pegar com a grafia em cache, resolve de novo e repete uma vez.
export async function executarComComarca(nav, painel, comarca, montar, { campo = painel.campoComarca, sheet } = {}) {
    let valor = await grafia(nav, painel, comarca, campo);
    let { resultado: res, tentativas } = await nav.executar(painel, montar(valor), sheet);
    const comarcaFalhou = !('erro' in res) && res.selecoes.some((s) => s.campo === campo && !s.ok);
    if (comarcaFalhou) {
        valor = await grafia(nav, painel, comarca, campo, { renovar: true });
        ({ resultado: res, tentativas } = await nav.executar(painel, montar(valor), sheet));
    }
    return { res, tentativas, valor };
}
// Tabela que só aparece com 1 valor de `campo` selecionado (ex.: 1 Órgão Julgador): percorre cada valor possível na comarca e junta.
// Qualquer valor que falhe => erro (lista parcial não é gravada; o painel continua com a relação anterior).
async function tabelaPorCampo(nav, painel, valorComarca, campo) {
    const base = [[painel.campoComarca, valorComarca]];
    const { resultado: r } = await nav.executar(painel, { selecoes: base, itens: [{ nome: 'v', tipo: 'campo', campo }] });
    if ('erro' in r)
        return { erro: r.erro };
    const rv = r.itens.v;
    if (ehErro(rv))
        return { erro: rv.erro };
    const valores = rv.valores.filter((v) => v.estado === 'O' || v.estado === 'S').map((v) => v.txt);
    let colunas = null, total = 0;
    const linhas = [];
    for (const v of valores) {
        const { resultado: t } = await nav.executar(painel, { selecoes: [...base, [campo, v]], itens: [{ ...painel.exporta_tabela_spec, nome: 't', tipo: 'tabela' }] });
        const tb = 'itens' in t ? t.itens.t : undefined;
        if ('erro' in t || ruins(t).length || !tb || ehErro(tb))
            return { erro: `${campo}=${v}: ${('erro' in t && t.erro) || (tb && ehErro(tb) && tb.erro) || 'filtro nao aplicado'}` };
        const tab = tb;
        if (colunas && tab.colunas.join('|') !== colunas.join('|'))
            return { erro: `${campo}=${v}: colunas diferentes` };
        colunas = tab.colunas;
        total += tab.total;
        linhas.push(...tab.linhas);
    }
    return { colunas: colunas || [], total, linhas, partes: valores.length };
}
// Coleta de um painel. Devolve {rec, tabela} (tabela = lista de processos, quando o painel exporta; nunca vai para 'coletas').
export async function coletarPainel(nav, painel, comarca, { exportar = true } = {}) {
    const rec = novaColeta(painel.id);
    const extra = exportar && painel.exporta_tabela_spec && !painel.lista_por_campo ? [{ ...painel.exporta_tabela_spec, nome: '__tabela', tipo: 'tabela' }] : [];
    let res, tentativas;
    try {
        ({ res, tentativas } = await executarComComarca(nav, painel, comarca, (v) => montarJob(painel, [[painel.campoComarca, v]], extra)));
    }
    catch (e) {
        return { rec: await finalizar(rec, 'FALHA', { erro: String(e.message || e) }) };
    }
    if ('erro' in res)
        return { rec: await finalizar(rec, 'FALHA', { tentativas, erro: res.erro }) };
    const sel = res.selecoes;
    if (ruins(res).length) {
        const msg = 'filtro nao aplicado: ' + ruins(res).map((s) => `${s.campo}=${s.valor}`).join(', ');
        return { rec: await finalizar(rec, 'FALHA', { tentativas, selecoes: sel, erro: msg }) };
    }
    const opc = new Set(Object.entries(painel.series || {}).filter(([, s]) => s.opcional).map(([n]) => `serie:${n}`));
    const avisos = gravarValores(rec, res, '', opc);
    const valorComarca = sel.find((s) => s.campo === painel.campoComarca).valor;
    for (const v of painel.variantes || []) { // mesma coleta restrita a uma origem (ex.: só PJe / só SEEU / só SISCOM)
        const job = montarJob(painel, [[painel.campoComarca, valorComarca], ...v.selecoes]);
        job.itens = job.itens.filter((i) => !i.nome.startsWith('__'));
        const { resultado: rv } = await nav.executar(painel, job);
        if ('erro' in rv || ruins(rv).length) {
            avisos.push(`variante ${v.id}: ${('erro' in rv && rv.erro) || 'filtro nao aplicado'}`);
            continue;
        }
        avisos.push(...gravarValores(rec, rv, v.id + '.').map((a) => `[${v.id}] ${a}`));
    }
    const c = (res.itens.__carimbo || {});
    let carimbo = c.txt || (c.linhas && c.linhas[0] && c.linhas[0][0] ? c.linhas[0][0].txt : null);
    if (carimbo === '-' || carimbo === '')
        carimbo = null;
    let tabela = null;
    const t = exportar && painel.lista_por_campo && painel.exporta_tabela_spec
        ? await tabelaPorCampo(nav, painel, valorComarca, painel.lista_por_campo) : res.itens.__tabela;
    if (t && !ehErro(t))
        tabela = t;
    else if (t)
        avisos.push(`tabela: ${t.erro}`);
    await finalizar(rec, avisos.length ? 'PARCIAL' : 'OK', { tentativas, carimbo, selecoes: sel, erro: avisos.join('; ') || null });
    return { rec, tabela, avisos };
}
