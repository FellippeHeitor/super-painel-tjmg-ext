// Monta o objeto de dados do painel (o "D" do front-end) a partir das coletas do IndexedDB. Porte de app/site.py (montar_dados).
// Só números do painel de origem; nada é estimado. Tendência só com coletas em dois dias distintos.
import * as db from './db.js';
import { mesIso } from './conclusoes.js';
import { prefs } from './config.js';
const OK = (c) => c.status === 'OK' || c.status === 'PARCIAL';
const arred = (n) => (n == null ? null : Number.isInteger(n) ? n : Math.round(n * 1e4) / 1e4);
const milhar = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const espacos = (s) => String(s).replace(/\s+/g, ' ').trim();
const NADA = { texto: null, numero: null };
// "MINAS NOVAS" -> "Minas Novas"; "SÃO JOÃO DEL-REI" -> "São João del-Rei"
export function nomeComarca(s) {
    const minus = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del']);
    return String(s || '').toLowerCase().split(/(\s+|-)/).map((p, i) => (i > 0 && minus.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
}
class Base {
    por = {};
    constructor(coletas) {
        for (const c of coletas.sort((a, b) => a.id - b.id))
            (this.por[c.painel] = this.por[c.painel] || []).push(c);
    }
    todas(p) { return this.por[p] || []; }
    ok(p) { const l = this.todas(p).filter(OK); return l.length ? l[l.length - 1] : null; }
    ultimaFalhou(p) { const l = this.todas(p); return !!(l.length && l[l.length - 1].status === 'FALHA'); }
    kv(p, chave) { const o = this.ok(p), v = o && o.valores[chave]; return v ? { texto: v.texto, numero: arred(v.numero) } : null; }
    serie(p, chave) { const o = this.ok(p); return o ? (o.series[chave] || []).filter((r) => r.numero != null).map((r) => ({ r: r.rotulo, v: arred(r.numero) })) : []; }
    mensal(rec, chave) {
        const out = {};
        if (!rec)
            return out;
        for (const r of rec.series[chave] || []) {
            if (r.numero == null)
                continue;
            try {
                out[mesIso(r.rotulo)] = r.numero;
            }
            catch (e) { /* rótulo que não é mês */ }
        }
        return out;
    }
    tendencia(p, chave) {
        const porDia = {};
        for (const c of this.todas(p))
            if (OK(c) && c.valores[chave] && c.valores[chave].numero != null)
                porDia[c.iniciada.slice(0, 10)] = c.valores[chave].numero;
        const dias = Object.keys(porDia).sort();
        if (dias.length < 2)
            return null;
        const atual = porDia[dias[dias.length - 1]], ant = porDia[dias[dias.length - 2]];
        return { anterior: arred(ant), data_anterior: dias[dias.length - 2], delta: arred(atual - ant), pct: ant ? arred((atual - ant) / ant * 100) : null };
    }
    fonte(p, nome, grupo) {
        const o = this.ok(p);
        return { id: p, nome, grupo, coletada_em: o ? o.iniciada : null, carimbo: o && o.carimbo ? espacos(o.carimbo) : null, falhou: this.ultimaFalhou(p) };
    }
}
function kpi(rotulo, par) {
    if (!par || par.texto == null)
        return null;
    let texto = par.texto;
    if (/^\d{4,}$/.test(String(texto)))
        texto = milhar(parseInt(texto, 10)); // número cru de expressão Qlik
    return { rotulo, texto, numero: arred(par.numero) };
}
function secao(B, spec) {
    const ok = B.ok(spec.painel);
    const s = { id: spec.painel, titulo: spec.titulo, kpis: [], series: [], coletada_em: ok ? ok.iniciada : null, carimbo: ok && ok.carimbo ? espacos(ok.carimbo) : null,
        ultima_falhou: B.ultimaFalhou(spec.painel), sem_dados: !ok };
    if (!ok)
        return s;
    const ref = spec.referencia;
    if (ref && ok.selecoes) {
        const sel = Object.fromEntries(ok.selecoes.map((x) => [x.campo, x.valor]));
        if (sel[ref.ano] && sel[ref.mes])
            s.referencia = `${String(parseInt(sel[ref.mes], 10)).padStart(2, '0')}/${sel[ref.ano]}`;
    }
    if (spec.tabela) {
        const cols = Object.entries(spec.tabela.colunas), dados = {};
        let base = null;
        for (const [chave] of cols) {
            dados[chave] = Object.fromEntries((ok.series[chave] || []).map((r) => [r.rotulo, r.texto]));
            if (!base || !base.length)
                base = Object.keys(dados[chave]);
        }
        if (base && base.length)
            s.tabela = { rotulo: spec.tabela.rotulo, colunas: cols.map((c) => c[1]), linhas: base.map((r) => [r, ...cols.map(([c]) => dados[c][r] ?? '—')]) };
    }
    for (const [chave, rotulo] of Object.entries(spec.kpis || {})) {
        const v = ok.valores[chave];
        if (v)
            s.kpis.push({ rotulo, texto: v.texto, numero: arred(v.numero) });
    }
    for (const [chave, cfg] of Object.entries(spec.series || {})) {
        let linhas = (ok.series[chave] || []).filter((r) => r.numero != null);
        if (!linhas.length)
            continue;
        const total = linhas.length;
        if (cfg.ordem === 'valor')
            linhas = [...linhas].sort((a, b) => b.numero - a.numero);
        if (cfg.top && linhas.length > cfg.top)
            linhas = linhas.slice(0, cfg.top);
        s.series.push({ rotulo: cfg.rotulo, ordem: cfg.ordem || 'original', total_itens: total, pontos: linhas.map((x) => ({ r: x.rotulo, v: arred(x.numero) })) });
    }
    return s;
}
function conclusoesD(B) {
    const dias = {}, meses = {}, fontes = {};
    for (const sis of ['pje', 'eproc']) {
        const o = B.ok(`conclusoes_${sis}`);
        fontes[sis] = o ? { coletada_em: o.iniciada, referencia: o.carimbo } : null;
        if (!o || !o.extra)
            continue;
        for (const d of o.extra.dias) {
            const x = (dias[d.data] = dias[d.data] || { data: d.data, pje: 0, eproc: 0 });
            x[sis] = d.eventos;
        }
        for (const m of o.extra.meses) {
            const x = (meses[m.mes] = meses[m.mes] || { mes: m.mes, pje: 0, eproc: 0, pje_proc: 0, eproc_proc: 0 });
            x[sis] = m.eventos;
            x[`${sis}_proc`] = m.processos;
        }
    }
    const ord = (o, k) => Object.values(o).sort((a, b) => (a[k] < b[k] ? -1 : 1));
    for (const d of Object.values(dias))
        d.total = d.pje + d.eproc;
    for (const m of Object.values(meses))
        m.total = m.pje + m.eproc;
    return { dias: ord(dias, 'data'), meses: ord(meses, 'mes'), fontes, nota: 'Conclusões contadas por evento. PJe e eProc somados; no mês, processos distintos aparecem em separado.' };
}
function movimentacao(B) {
    const d = B.ok('dados_estrategicos'), e = B.ok('mov_eproc'), m = B.ok('mov_mes_corrente');
    const vd = (k) => (d && d.valores[k]) || null, ve = (k) => (e && e.valores[k]) || null, vm = (k) => (m && m.valores[k]) || null;
    const ROT = { distribuidos: 'Distribuídos por mês', baixas: 'Baixas por mês', julgamentos: 'Julgamentos por mês' };
    const chaves = Object.keys(ROT);
    const series = {};
    for (const sis of ['pje', 'seeu', 'siscom']) {
        series[sis] = { distribuidos: B.mensal(d, `${sis}.distribuidos_mes`), baixas: B.mensal(d, `${sis}.baixas_mes`), julgamentos: B.mensal(d, `${sis}.julgamentos_mes`), acervo: B.mensal(d, `${sis}.acervo_mes`) };
    }
    series.eproc = { distribuidos: B.mensal(e, 'distribuicao_mes'), baixas: B.mensal(e, 'baixas_mes'), julgamentos: B.mensal(e, 'julgamentos_mes'), acervo: {} };
    const pontos = (o) => Object.keys(o).sort().map((k) => ({ m: k, v: arred(o[k]) }));
    const vazio = (o) => !Object.keys(o).length;
    const bloco = (sis, nome, nota, kpis) => {
        const sr = chaves.filter((k) => !vazio(series[sis][k])).map((k) => ({ chave: k, rotulo: ROT[k], pontos: pontos(series[sis][k]) }));
        if (!vazio(series[sis].acervo))
            sr.push({ chave: 'acervo', rotulo: 'Acervo ao fim de cada mês', pontos: pontos(series[sis].acervo) });
        return { id: sis, nome, nota, kpis: kpis.filter(Boolean), series: sr };
    };
    const kd = (sis, chave, rotulo) => kpi(rotulo, vd(`${sis}.${chave}`));
    const tot = {};
    for (const k of chaves) {
        const acc = {};
        for (const sis of ['eproc', 'pje', 'seeu', 'siscom'])
            for (const [mes, v] of Object.entries(series[sis][k]))
                acc[mes] = (acc[mes] || 0) + v;
        tot[k] = acc;
    }
    const nsoma = (chD, chE) => {
        const vals = [...['pje', 'seeu', 'siscom'].map((s) => (vd(`${s}.${chD}`) || NADA).numero), (ve(chE) || NADA).numero].filter((v) => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };
    const kpiN = (rotulo, n) => (n != null ? { rotulo, texto: milhar(n), numero: Math.trunc(n) } : null);
    const out = [];
    out.push({ id: 'total', nome: 'Total (todos os sistemas)',
        nota: 'Soma de eProc + PJe + SEEU + SISCOM (físicos) para distribuídos, baixas e julgamentos. Atenção: PJe/SEEU/SISCOM contam a 1ª baixa; o eProc conta todos os eventos de baixa. O acervo NÃO é somado: processos migrados do PJe para o eProc podem constar nos dois; veja o acervo de cada sistema nas outras abas.',
        kpis: [kpiN('Distribuídos (período dos painéis)', nsoma('distribuidos', 'distribuicao_total')), kpiN('Baixas (período dos painéis)', nsoma('baixas_1a', 'baixa_total')),
            kpiN('Julgamentos (período dos painéis)', nsoma('julgamentos', 'julgamentos_total'))].filter(Boolean),
        series: chaves.filter((k) => !vazio(tot[k])).map((k) => ({ chave: k, rotulo: ROT[k], pontos: pontos(tot[k]) })) });
    out.push(bloco('eproc', 'eProc', 'Painel de movimentação do eProc. Acervo = processos com ACERVO=1; Migrados = processos vindos do PJe.', [kpi('Distribuídos', ve('distribuicao_total')), kpi('Baixas', ve('baixa_total')), kpi('Julgamentos', ve('julgamentos_total')), kpi('Acervo', ve('acervo')), kpi('Migrados', ve('migrados'))]));
    out.push(bloco('pje', 'PJe', 'PJe (1ª instância, inclui Turma Recursal). Entradas e saídas do mês vêm do painel de movimentação do mês corrente, que é só do PJe.', [kpi('Entradas no mês corrente', vm('entradas_mes')), kpi('Saídas no mês corrente', vm('saidas_mes')),
        kd('pje', 'distribuidos', 'Distribuídos (24 meses)'), kd('pje', 'baixas_1a', 'Baixas, 1ª baixa (24 meses)'), kd('pje', 'julgamentos', 'Julgamentos (24 meses)'),
        kd('pje', 'acervo_final', 'Acervo ativo, fim do período'), kd('pje', 'paralisados_60', 'Paralisados > 60 dias'),
        kd('pje', 'paralisados_100', 'Paralisados > 100 dias'), kd('pje', 'paralisados_120', 'Paralisados > 120 dias')]));
    for (const [sis, nome, nota] of [['seeu', 'SEEU', 'Execução penal (SEEU).'], ['siscom', 'SISCOM (físicos)', 'Processos físicos (SISCOM).']]) {
        out.push(bloco(sis, nome, nota, [kd(sis, 'distribuidos', 'Distribuídos (24 meses)'), kd(sis, 'baixas_1a', 'Baixas, 1ª baixa (24 meses)'),
            kd(sis, 'julgamentos', 'Julgamentos (24 meses)'), kd(sis, 'acervo_final', 'Acervo ativo, fim do período')]));
    }
    return { sistemas: out, coletas: { eproc: e ? e.iniciada : null, pje_seeu_siscom: d ? d.iniciada : null, pje_mes_corrente: m ? m.iniciada : null },
        carimbos: { eproc: e ? e.carimbo : null, pje_seeu_siscom: d ? d.carimbo : null }, eproc_inicio: pontos(series.eproc.distribuidos).map((p) => p.m)[0] || null };
}
function acervoEproc(B) {
    const e = B.ok('mov_eproc');
    if (!e)
        return null;
    const pares = (chave) => (e.series[chave] || []).filter((r) => r.numero != null).map((r) => ({ r: r.rotulo, v: arred(r.numero) }));
    const mensal = (chave) => { const o = B.mensal(e, chave); return Object.keys(o).sort().map((m) => ({ m, v: arred(o[m]) })); };
    const classes = pares('acervo_por_classe').sort((a, b) => b.v - a.v);
    const ve = (k) => e.valores[k] || null;
    return { coletada_em: e.iniciada, carimbo: e.carimbo,
        kpis: [kpi('Acervo (ACERVO=1)', ve('acervo')), kpi('Migrados', ve('migrados')), kpi('Distribuídos', ve('distribuicao_total')), kpi('Baixas', ve('baixa_total')), kpi('Julgamentos', ve('julgamentos_total'))].filter(Boolean),
        por_classe: classes.slice(0, 10), total_classes: classes.length, migrados_mes: mensal('migrados_mes'), migrados_mes_no_acervo: mensal('migrados_mes_no_acervo') };
}
// ---------- Metas Nacionais do CNJ ----------
const TITULOS_METAS = { 1: 'Julgar mais processos do que os distribuídos', 2: 'Identificar e julgar os processos mais antigos', 3: 'Aumentar o índice de conciliação',
    4: 'Crimes contra a Administração Pública e improbidade', 5: 'Reduzir a taxa de congestionamento líquida', 6: 'Ações ambientais',
    7: 'Comunidades indígenas e quilombolas; crimes de racismo, ódio e discriminação', 8: 'Feminicídio e violência doméstica contra a mulher',
    10: 'Infância e Juventude (conhecimento e ato infracional)' };
const SUBABAS = { 2: ['Justiça Comum', 'Juizados e Turmas', 'Antigos (distribuídos até 2011)'], 4: ['Improbidade administrativa', 'Crime contra a Administração Pública'],
    7: ['Comunidade indígena', 'Comunidade quilombola', 'Preconceito (racismo, injúria racial, ódio e discriminação)'], 8: ['Feminicídio', 'Violência doméstica e familiar contra a mulher'] };
const ENTRADAS = 'Entradas (distribuídos + dessobrestados − suspensos)';
function rotuloExpr(expr) {
    if (expr.includes('||')) {
        const i = expr.indexOf('||'), tl = expr.slice(0, i).toLowerCase();
        for (const [chave, rot] of [['julgado', 'Julgados'], ['suspenso', 'Suspensos'], ['dessobrestado', 'Dessobrestados'], ['casos novos', 'Casos novos (distribuídos)'], ['entradas', 'Entradas']]) {
            if (tl.includes(chave))
                return rot;
        }
        return null;
    }
    const campos = new Set(expr.match(/\b(DISTRIBUIDO|DESSOBRESTADO|SUSPENSO|JULGADO)\b/g) || []);
    if (expr.includes('Aggr') || expr.includes('Count(') || !campos.size)
        return null;
    const so = (...c) => campos.size === c.length && c.every((x) => campos.has(x));
    if (so('JULGADO'))
        return 'Julgados';
    if (so('DISTRIBUIDO'))
        return 'Distribuídos';
    if (so('DESSOBRESTADO'))
        return 'Dessobrestados';
    if (so('SUSPENSO'))
        return 'Suspensos';
    if (so('DISTRIBUIDO', 'DESSOBRESTADO', 'SUSPENSO'))
        return ENTRADAS;
    return null;
}
function pct(texto) {
    if (texto == null)
        return null;
    const s = String(texto).replace('%', '').replace(/\./g, '').replace(',', '.').trim();
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
}
function metasD(B) {
    const ok = B.ok('metas_cnj');
    if (!ok)
        return null;
    const val = ok.valores;
    const ser = (chave) => (ok.series[chave] || []).map((r) => [r.rotulo, r.texto]);
    const n = (k) => (val[k] ? val[k].numero : null);
    const f0 = (x) => milhar(x);
    const fp = (x) => (x * 100).toFixed(2).replace('.', ',') + '%';
    const num = (rotulo, v) => (v != null ? { rotulo, texto: v, nota: null } : null);
    const razao = (a, b) => { const na = n(a), nb = n(b); return na != null && nb ? fp(na / nb) : null; };
    const comps = {};
    for (const m of [1, 6, 10]) {
        const vs = ['j', 'd', 'dess', 's'].map((c) => n(`m${m}_${c}`));
        if (vs.some((x) => x == null))
            continue;
        const [j, d, de, su] = vs;
        const ent = d + de - su;
        comps[m] = [num('Julgados', f0(j)), num(ENTRADAS, f0(ent)), num('Julgados ÷ entradas', ent ? fp(j / ent) : null), num('Distribuídos', f0(d)), num('Dessobrestados', f0(de)), num('Suspensos', f0(su))];
    }
    const f = (k) => { const v = n(k); return v != null ? f0(v) : null; };
    if (n('m3_conc') != null) {
        comps[3] = [num('Índice de conciliação no ano (conciliações ÷ sentenças)', razao('m3_conc', 'm3_sent')), num('Conciliações no ano', f('m3_conc')), num('Sentenças no ano', f('m3_sent')),
            num('Índice de conciliação no ano anterior', razao('m3_conc_ant', 'm3_sent_ant')), num('Conciliações no ano anterior', f('m3_conc_ant')), num('Sentenças no ano anterior', f('m3_sent_ant'))];
    }
    if (n('m5_cpl') != null && n('m5_bx') != null) {
        const taxa = (a, b) => { const na = n(a), nb = n(b); return na != null && nb != null && na + nb ? na / (na + nb) : null; };
        const t1 = taxa('m5_cpl', 'm5_bx'), t0 = taxa('m5_cpl_ant', 'm5_bx_ant');
        comps[5] = [num('Taxa de congestionamento líquida no ano', t1 != null ? fp(t1) : null), num('Taxa de congestionamento líquida no ano anterior', t0 != null ? fp(t0) : null),
            num('Casos pendentes líquidos (ano)', f('m5_cpl')), num('Baixados (acumulado no ano)', f('m5_bx')), num('Casos pendentes líquidos (ano anterior)', f('m5_cpl_ant')), num('Baixados (ano anterior)', f('m5_bx_ant'))];
    }
    const avaliar = (prefixo) => {
        const txt = val[`${prefixo}_cumprimento`] ? val[`${prefixo}_cumprimento`].texto : null;
        const evo = ser(`${prefixo}_evolucao`).filter(([, t]) => pct(t) != null).map(([r, t]) => ({ r, v: pct(t) }));
        const varas = ser(`${prefixo}_varas`).filter(([, t]) => pct(t) != null).map(([r, t]) => ({ r: r.replace(/ da comarca de .*$/i, ''), v: pct(t) }));
        const p = pct(txt);
        const status = p == null ? 'sem_dados' : p >= 100 ? 'cumprida' : p >= 90 ? 'quase' : 'abaixo';
        return { txt, evo, varas, p, status };
    };
    const numerosSub = (prefixo) => {
        const achados = {};
        for (const ch of Object.keys(val).sort()) {
            const v = val[ch];
            if (ch.startsWith(`${prefixo}_comp.`) && v.numero != null) {
                const r = rotuloExpr(v.texto || '');
                if (r && !(r in achados))
                    achados[r] = v.numero;
            }
        }
        const entK = ENTRADAS in achados ? ENTRADAS : 'Entradas' in achados ? 'Entradas' : ENTRADAS;
        const out = [];
        if ('Julgados' in achados)
            out.push(num('Julgados', f0(achados.Julgados)));
        if (entK in achados)
            out.push(num(entK, f0(achados[entK])));
        if ('Julgados' in achados && achados[entK])
            out.push(num('Julgados ÷ entradas', fp(achados.Julgados / achados[entK])));
        for (const r of ['Distribuídos', 'Casos novos (distribuídos)', 'Dessobrestados', 'Suspensos'])
            if (r in achados)
                out.push(num(r, f0(achados[r])));
        return out.filter((x) => !!x);
    };
    const ORDEM = { abaixo: 0, quase: 1, cumprida: 2, sem_dados: 3 };
    const ehEntrada = (x) => /^(Entradas|Distribu|Casos novos)/.test(x.rotulo);
    const metas = [];
    for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
        const subs = [];
        let a;
        if (SUBABAS[m]) {
            SUBABAS[m].forEach((rot, kx) => {
                const s = avaliar(`m${m}s${kx}`), nums = numerosSub(`m${m}s${kx}`);
                let st = s.status;
                const entradas = nums.filter(ehEntrada);
                if (nums.length && entradas.length && entradas.every((x) => x.texto === '0' || x.texto === '0,00%'))
                    st = 'sem_dados';
                subs.push({ k: kx, rotulo: rot, cumprimento: s.txt, pct: s.p, status: st, evolucao: s.evo, varas: s.varas, numeros: nums });
            });
            const vivos = subs.filter((x) => x.status !== 'sem_dados');
            a = { txt: null, evo: [], varas: [], p: null, status: vivos.length ? vivos.map((x) => x.status).sort((x, y) => ORDEM[x] - ORDEM[y])[0] : 'sem_dados' };
        }
        else
            a = avaliar(`m${m}`);
        let desc = (val[`m${m}_descricao`] || {}).texto || '';
        desc = desc.replace(/\^\[|\]\((?:center|inherit)\)|\\\(|\\\)/g, '');
        desc = espacos(desc.replace(/<[^>]+>/g, ' '));
        metas.push({ n: m, nome: `Meta ${m}`, titulo: TITULOS_METAS[m], descricao: desc, cumprimento: a.txt, pct: a.p, status: a.status,
            evolucao: a.evo, varas: a.varas, numeros: (comps[m] || []).filter(Boolean), subs });
    }
    return { coletada_em: ok.iniciada, carimbo: ok.carimbo, metas };
}
// Acervo total LÍQUIDO = (PJe + SEEU + SISCOM no fim do último mês do painel estratégico) + (eProc hoje) − migrados ao eProc depois daquele mês
// que hoje estão no acervo do eProc (contariam nos dois). Bruto e desconto ficam visíveis.
function acervoTotal(B, seriePje) {
    const base = B.kv('dados_estrategicos', 'acervo_final'), ep = B.kv('mov_eproc', 'acervo');
    if (!base || !ep || base.numero == null || ep.numero == null || !seriePje.length)
        return null;
    const ultimo = seriePje[seriePje.length - 1].m, e = B.ok('mov_eproc');
    const meses = B.mensal(e, 'migrados_mes_no_acervo');
    const apos = Object.keys(meses).length ? Math.trunc(Object.entries(meses).filter(([m]) => m > ultimo).reduce((a, [, v]) => a + v, 0)) : null;
    const bruto = Math.trunc(base.numero + ep.numero), desc = apos || 0, total = bruto - desc;
    return { numero: total, texto: milhar(total), bruto, bruto_texto: milhar(bruto), descontados: desc, descontados_texto: milhar(desc),
        pje_seeu_siscom: base, eproc: ep, base_pje: ultimo, data_eproc: e ? e.iniciada.slice(0, 10) : null, sobreposicao_max: apos };
}
function visao(B) {
    const k = (p, chave) => { const v = B.kv(p, chave); return v ? { ...v, tendencia: B.tendencia(p, chave) } : null; };
    const d = B.ok('dados_estrategicos');
    const acervoSis = Object.fromEntries(['pje', 'seeu', 'siscom'].map((s) => [s, B.mensal(d, `${s}.acervo_mes`)]));
    // só entram os sistemas que a comarca tem (série não vazia); um mês só conta se todos eles tiverem o valor
    const ativos = Object.keys(acervoSis).filter((s) => Object.keys(acervoSis[s]).length);
    const meses = [...new Set(ativos.flatMap((s) => Object.keys(acervoSis[s])))].sort();
    const serie = meses.filter((m) => ativos.every((s) => m in acervoSis[s])).map((m) => ({ m, v: arred(ativos.reduce((a, s) => a + acervoSis[s][m], 0)) }));
    return {
        acervo: k('dados_estrategicos', 'acervo_final'), acervo_eproc: k('mov_eproc', 'acervo'), eproc_acervo: acervoEproc(B),
        acervo_total: acervoTotal(B, serie), acervo_serie: serie,
        tarefas_pendentes: k('tarefas_pje_diario', 'tarefas_pendentes'),
        paralisados_60: k('dados_estrategicos', 'pje.paralisados_60'), paralisados_100: k('dados_estrategicos', 'pje.paralisados_100'),
        paralisados_120: k('dados_estrategicos', 'pje.paralisados_120'),
        docs_nao_lidos: k('docs_nao_lidos', 'total_documentos'),
        migrados: k('migrador_pje', 'migrados'), aptos: k('migrador_pje', 'aptos'), inaptos: k('migrador_pje', 'inaptos'), migracao_total: k('migrador_pje', 'total_processos'),
        indice_baixas: B.kv('dados_estrategicos', 'indice_baixas'), indice_julgamentos: B.kv('dados_estrategicos', 'indice_julgamentos'),
        migracao_series: { aptos_por_unidade: B.serie('migrador_pje', 'aptos_por_unidade'), inaptos_por_orgao: B.serie('migrador_pje', 'inaptos_por_orgao'), migrados_por_orgao: B.serie('migrador_pje', 'migrados_por_orgao') },
        fontes: [B.fonte('tarefas_pje_diario', 'Tarefas PJe (diário)', 'PJe'), B.fonte('tarefas_pje_semanal', 'Tarefas PJe (semanal)', 'PJe'),
            B.fonte('docs_nao_lidos', 'Documentos não lidos', 'PJe'), B.fonte('migrador_pje', 'Migrador PJe', 'PJe'),
            B.fonte('mov_mes_corrente', 'Movimentação do mês (PJe)', 'PJe'), B.fonte('mov_eproc', 'Movimentação eProc', 'eProc'),
            B.fonte('conclusoes_eproc', 'Conclusões eProc', 'eProc'), B.fonte('conclusoes_pje', 'Conclusões PJe', 'PJe'),
            B.fonte('dados_estrategicos', 'Dados estratégicos', 'Estratégicos'), B.fonte('acervo_fisico', 'Acervo físico', 'Apoio'),
            B.fonte('apoio_planejamento', 'Apoio ao planejamento', 'Planejamento'), B.fonte('metas_cnj', 'Metas Nacionais do CNJ', 'Metas')],
    };
}
// {D, P}: D = dados do painel; P = relações de processos (mesmo formato do antigo processos.json). null se ainda não houve coleta.
export async function montar() {
    const coletas = await db.todasColetas();
    if (!coletas.some(OK))
        return null;
    const { comarca } = await prefs();
    const B = new Base(coletas);
    const site = await (await fetch(chrome.runtime.getURL('config/site.json'))).json();
    const nome = nomeComarca(comarca);
    const D = { titulo: `Super Painel — Comarca de ${nome}`, subtitulo: 'Painéis do Qlik Sense (TJMG) consolidados', comarca: nome,
        gerado_em: new Date().toISOString(), conclusoes: conclusoesD(B), movimentacao: movimentacao(B), visao: visao(B), metas: metasD(B),
        secoes: site.secoes.map((sp) => secao(B, sp)) };
    const L = await db.listas();
    const P = { gerado_em: D.gerado_em, pendentes: L.pendentes || null, semanal: L.semanal || null, docs: L.docs || null, metas: L.metas || null, apoio: L.apoio || null };
    return { D, P };
}
