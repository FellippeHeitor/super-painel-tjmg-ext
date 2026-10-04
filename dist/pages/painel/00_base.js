// ===== núcleo: dados, utilitários, ícones, tema, frescor =====
const D = window.__D;   // montado por carregar.js a partir do IndexedDB (src/dados.js)
const nf = new Intl.NumberFormat('pt-BR');
const fmt = (n) => nf.format(n);
const fmt1 = (n) => n.toFixed(1).replace('.', ',');
const MES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, ...filhos){
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === 'class') e.className = v; else e.setAttribute(k, v === true ? '' : v); }
  for (const f of filhos.flat()) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}
function sv(tag, attrs, ...filhos){
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  for (const f of filhos) if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}
const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dataBR = (iso) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
const dtHora = (iso) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}); };
const horasDesde = (iso) => (Date.now() - new Date(iso).getTime()) / 36e5;
const mesRot = (m) => { const [a, mm] = m.split('-'); return `${MES[+mm - 1].slice(0, 3)}/${a.slice(2)}`; };
const mesLongo = (m) => { const [a, mm] = m.split('-'); return `${MES[+mm - 1]}/${a}`; };
function ha(iso){
  if (!iso) return '—';
  const h = horasDesde(iso);
  if (h < 0.05) return 'agora';
  if (h < 1) return `há ${Math.round(h * 60)} min`;
  if (h < 48) return `há ${Math.round(h)} h`;
  return `há ${Math.round(h / 24)} dias`;
}

// ícones (traços simples, decorativos: aria-hidden)
const ICONES = {
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  lista: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  relogio: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  alerta: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  nuvem: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  check: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  busca: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M21 21l-4.35-4.35',
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  tend: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  caixa: 'M21 8v13H3V8 M1 3h22v5H1z M10 12h4',
  troca: 'M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
  barras: 'M18 20V10 M12 20V4 M6 20v-6',
  baixar: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  tema: 'M12 3a9 9 0 1 0 0 18V3z',
  olho: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  fechar: 'M18 6L6 18 M6 6l12 12',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
};
function ico(nome, tam = 20){
  const s = sv('svg', {width: tam, height: tam, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'});
  for (const d of (ICONES[nome] || '').split(' M').map((p, i) => (i ? 'M' + p : p))) s.append(sv('path', {d}));
  return s;
}

// tema: automático | claro | escuro (preferência salva)
const TEMAS = ['auto', 'light', 'dark'], ROT_TEMA = {auto: 'Automático', light: 'Claro', dark: 'Escuro'};
function lerPref(k, padrao){ try { return localStorage.getItem(k) || padrao; } catch (e) { return padrao; } }
function gravarPref(k, v){ try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem salvar */ } }
function aplicarTema(t){
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const b = document.getElementById('tema');
  b.replaceChildren(ico('tema', 18), el('span', {class: 'vh'}, 'Tema: ' + ROT_TEMA[t]));
  b.title = 'Tema: ' + ROT_TEMA[t] + ' (clique para alternar)';
}

// ===== frescor e status das fontes =====
const LIMITE_H = {tarefas_pje_diario: 48, docs_nao_lidos: 48, mov_mes_corrente: 48, mov_eproc: 48, conclusoes_eproc: 48, conclusoes_pje: 48, migrador_pje: 48,
  acervo_fisico: 48, tarefas_pje_semanal: 24 * 8, dados_estrategicos: 24 * 40, apoio_planejamento: 24 * 40, metas_cnj: 24 * 40};
function statusFonte(f){
  if (!f.coletada_em) return 'err';
  if (f.falhou) return 'warn';
  return horasDesde(f.coletada_em) > (LIMITE_H[f.id] || 48) ? 'warn' : 'ok';
}
const ROT_STATUS = {ok: 'em dia', warn: 'atenção', err: 'sem dados'};
const FONTES_ID = Object.fromEntries(D.visao.fontes.map(f => [f.id, f]));
function carimboData(f){ const m = f && f.carimbo && /(\d{2}\/\d{2})\/\d{4}/.exec(f.carimbo); return m ? m[1] : null; }
function linhaFonte(ids){   // "Coletado em … · Painel: …" para o rodapé de cada visão
  const p = el('p', {class: 'meta'});
  const fs = ids.map(i => FONTES_ID[i]).filter(Boolean);
  fs.forEach((f, k) => {
    if (k) p.append(' · ');
    const st = statusFonte(f);
    p.append(el('span', {title: ROT_STATUS[st]}, el('span', {class: 'dot ' + st}), ' '), `${f.nome}: coletado ${ha(f.coletada_em)} (${dtHora(f.coletada_em)})` + (f.carimbo ? `; painel: ${f.carimbo.replace(/\n/g, ' ')}` : '') + (f.falhou ? ' — a última tentativa falhou, exibindo a anterior' : ''));
  });
  return p;
}
function desenharTopo(){
  const fs = D.visao.fontes, validas = fs.filter(f => f.coletada_em);
  const maisRecente = validas.map(f => f.coletada_em).sort().pop();
  const pior = fs.reduce((p, f) => { const s = statusFonte(f); return s === 'err' || p === 'err' ? 'err' : (s === 'warn' || p === 'warn' ? 'warn' : 'ok'); }, 'ok');
  const rot = {ok: 'Coleta em dia', warn: 'Atenção: há fonte desatualizada', err: 'Fonte sem dados'}[pior];
  const fr = document.getElementById('fresh');
  fr.replaceChildren(el('b', {}, 'Última atualização'), el('span', {class: 'det'}, dtHora(maisRecente) + ' · ' + ha(maisRecente) + ' '), el('span', {}, el('span', {class: 'dot ' + (pior === 'ok' ? 'ok' : pior)}), ' ' + rot));
  const grupos = {};
  for (const f of fs) (grupos[f.grupo] = grupos[f.grupo] || []).push(f);
  const box = document.getElementById('fontes'); box.replaceChildren();
  for (const g of ['PJe', 'eProc', 'Estratégicos', 'Planejamento', 'Metas']) {
    const L = grupos[g]; if (!L) continue;
    const st = L.map(statusFonte).reduce((a, b) => (a === 'err' || b === 'err') ? 'err' : (a === 'warn' || b === 'warn') ? 'warn' : 'ok', 'ok');
    const mensal = g === 'Estratégicos' || g === 'Planejamento' || g === 'Metas';
    const data = mensal ? carimboData(L[0]) : null;
    box.append(el('span', {title: `${g}: ${ROT_STATUS[st]}` + (data ? ` (painel de ${data})` : '')}, el('span', {class: 'dot ' + st}), ' ' + g + (data ? ' ' + data : ''), el('span', {class: 'vh'}, ' ' + ROT_STATUS[st])));
  }
}

// ===== componentes de apresentação =====
function badgeDias(n){
  if (n == null || n === '') return el('span', {class: 'vh'}, 'sem dado');
  const nivel = n >= 120 ? ['crit', '▲▲', 'crítico'] : n >= 100 ? ['alto', '▲', 'alto'] : n >= 60 ? ['aten', '●', 'atenção'] : ['ok', '', 'normal'];
  return el('span', {class: 'badge ' + nivel[0], title: `${fmt(n)} dias (${nivel[2]})`}, nivel[1] ? el('span', {'aria-hidden': 'true'}, nivel[1]) : null, `${fmt(n)} d`, el('span', {class: 'vh'}, ` dias, nível ${nivel[2]}`));
}
function tendHtml(t, unidade = '%'){   // t = {delta, pct, anterior, data_anterior} ou {pct, rotulo}
  if (!t) return el('span', {class: 'tend eq'}, 'sem comparação ainda');
  const p = t.pct;
  if (p == null) return el('span', {class: 'tend eq'}, 'sem comparação');
  const cls = p > 0 ? 'up' : p < 0 ? 'down' : 'eq', seta = p > 0 ? '▲' : p < 0 ? '▼' : '=';
  return el('span', {class: 'tend ' + cls}, `${seta} ${fmt1(Math.abs(p))}${unidade}`, t.rotulo ? el('span', {class: 'vh'}, ' ' + t.rotulo) : null);
}
function kpiCard({icone, rotulo, valor, sub, tend, href, classe, ariaLabel}){
  const corpo = [el('span', {class: 'ic'}, ico(icone, 18), rotulo), el('span', {class: 'v'}, valor), tend || null, sub ? el('span', {class: 's'}, sub) : null];
  const a = el(href ? 'a' : 'div', {class: 'kpi ' + (classe || '') + (href ? '' : ' nolink'), href, 'aria-label': ariaLabel}, ...corpo);
  return a;
}
function kpis(lista){   // cartões simples {rotulo, texto, numero}
  const g = el('div', {class: 'grid g-kpi'});
  for (const k of lista) g.append(el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, k.rotulo), el('span', {class: 'v'}, (k.numero != null && Number.isInteger(k.numero) && /^[\d.\s]+$/.test(k.texto || '')) ? fmt(k.numero) : (k.texto || '—'))));
  return g;
}
function barras(serie, limite){
  const pts = limite ? serie.pontos.slice(0, limite) : serie.pontos;
  const max = Math.max(...pts.map(p => p.v), 1);
  const g = el('div', {class: 'barras', role: 'list'});
  for (const p of pts) g.append(el('div', {class: 'r', title: p.r, role: 'listitem'}, p.r), el('div', {class: 't', 'aria-hidden': 'true'}, el('i', {style: `width:${Math.max(0, p.v / max * 100)}%`})), el('div', {class: 'n'}, (serie.formato || ((x) => Number.isInteger(x) ? fmt(x) : String(x)))(p.v)));
  return el('div', {}, el('h3', {}, serie.rotulo + (serie.total_itens > pts.length ? ` (top ${pts.length} de ${serie.total_itens})` : '')), g);
}
function tabelaSimples(cabecalho, linhas, legenda){
  const t = el('table', {class: 'num'}, legenda ? el('caption', {class: 'vh'}, legenda) : null, el('thead', {}, el('tr', {}, ...cabecalho.map(c => el('th', {scope: 'col'}, c)))));
  t.append(el('tbody', {}, ...linhas.map(l => el('tr', {}, ...l.map(x => el('td', {}, x))))));
  return el('div', {class: 'rolagem'}, t);
}
function verDados(rotulos, series, titulo, formato = fmt){   // alternativa em tabela para gráficos (acessibilidade)
  const d = el('details', {class: 'dados'}, el('summary', {}, 'Ver dados do gráfico em tabela'));
  d.append(tabelaSimples(['Período', ...series.map(s => s.nome)], rotulos.map((r, i) => [r, ...series.map(s => s.valores[i] == null ? '—' : formato(s.valores[i]))]), titulo));
  return d;
}

// ===== gráficos SVG (sem bibliotecas) =====
const CORES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];
function eixoY(maximo){ const passos = 4, bruto = maximo / passos, mag = Math.pow(10, Math.floor(Math.log10(bruto || 1))); const base = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= bruto) || mag; return {passo: base, topo: base * passos}; }
// rótulo de valor sobre pontos/barras; vira vertical quando não cabe na horizontal
function rotuloValor(x, y, v, vertical, formato = fmt){
  const t = sv('text', {x, y: y - 5, 'text-anchor': vertical ? 'start' : 'middle', 'font-size': vertical ? 9 : 10, 'font-weight': 600, class: 'val'}, formato(v));
  if (vertical) t.setAttribute('transform', `rotate(-90 ${x} ${y - 5})`);
  return t;
}
function graficoLinha(rotulos, series, {titulo, area = false, altura = 190, formato = fmt} = {}){
  const W = 640, n = rotulos.length, pl = 44, pr = 14, pb = 26, vertical = (W - pl - pr) / Math.max(n - 1, 1) < 36, pt = vertical ? 38 : 20, H = altura + (vertical ? 20 : 0);
  const todos = series.flatMap(s => s.valores.filter(v => v != null)); const {passo, topo} = eixoY(Math.max(...todos, 1));
  const x = (i) => pl + 12 + (n <= 1 ? (W - pl - pr - 24) / 2 : i * (W - pl - pr - 24) / (n - 1)), y = (v) => pt + (H - pt - pb) * (1 - v / topo);
  const s = sv('svg', {class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': titulo || 'Gráfico de linhas'});
  for (let v = 0; v <= topo + 1e-9; v += passo) { s.append(sv('line', {class: 'grid-l', x1: pl, x2: W - pr, y1: y(v), y2: y(v)}), sv('text', {x: pl - 6, y: y(v) + 3, 'text-anchor': 'end'}, formato(v))); }
  const salto = Math.ceil(n / 8);
  rotulos.forEach((r, i) => { if (i % salto === 0 || (i === n - 1 && (n - 1) % salto > salto / 2)) s.append(sv('text', {x: x(i), y: H - 8, 'text-anchor': 'middle'}, r)); });
  series.forEach((sr, k) => {
    const pts = sr.valores.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    if (!pts.length) return;
    if (area && k === 0) s.append(sv('path', {d: `M${pts[0][0]},${y(0)} L${pts.map(p => p.join(',')).join(' L')} L${pts[pts.length - 1][0]},${y(0)} Z`, fill: CORES[k], opacity: .12}));
    s.append(sv('path', {d: 'M' + pts.map(p => p.join(',')).join(' L'), fill: 'none', stroke: CORES[k], 'stroke-width': 2.2, 'stroke-linejoin': 'round'}));
    sr.valores.forEach((v, i) => { if (v != null) { s.append(sv('circle', {cx: x(i), cy: y(v), r: 3.2, fill: CORES[k]}, sv('title', {}, `${sr.nome} · ${rotulos[i]}: ${formato(v)}`))); if (series.length === 1 || !vertical || k === 0) s.append(rotuloValor(x(i), y(v) - 2, v, vertical, formato)); } });
  });
  return s;
}
function graficoBarrasGrupo(rotulos, series, {titulo, altura = 190, formato = fmt} = {}){
  const W = 640, pl = 44, pr = 10, pb = 26, n = rotulos.length, ns = series.length;
  const larg0 = (W - pl - pr) / n, vertical = (larg0 * .78) / ns < 26, pt = vertical ? 40 : 20, H = altura + (vertical ? 22 : 0);
  const todos = series.flatMap(s => s.valores.filter(v => v != null)); const {passo, topo} = eixoY(Math.max(...todos, 1));
  const larg = larg0, bw = Math.max(2, (larg * .78) / ns), y = (v) => pt + (H - pt - pb) * (1 - v / topo);
  const s = sv('svg', {class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': titulo || 'Gráfico de barras'});
  for (let v = 0; v <= topo + 1e-9; v += passo) { s.append(sv('line', {class: 'grid-l', x1: pl, x2: W - pr, y1: y(v), y2: y(v)}), sv('text', {x: pl - 6, y: y(v) + 3, 'text-anchor': 'end'}, formato(v))); }
  const salto = Math.ceil(n / 12);
  rotulos.forEach((r, i) => {
    const x0 = pl + i * larg + larg * .11;
    series.forEach((sr, k) => { const v = sr.valores[i]; if (v == null) return; s.append(sv('rect', {class: 'bar', x: x0 + k * bw, y: y(v), width: bw - 1, height: Math.max(0, y(0) - y(v)), fill: CORES[k], rx: 1.5}, sv('title', {}, `${sr.nome} · ${r}: ${formato(v)}`))); s.append(rotuloValor(x0 + k * bw + (bw - 1) / 2, y(v), v, vertical, formato)); });
    if (i % salto === 0 || (i === n - 1 && (n - 1) % salto > salto / 2)) s.append(sv('text', {x: pl + i * larg + larg / 2, y: H - 8, 'text-anchor': 'middle'}, r));
  });
  return s;
}
function legenda(series){ return el('div', {class: 'leg'}, ...series.map((s, k) => el('span', {}, el('i', {style: `background:${CORES[k]}`}), s.nome))); }
function graficoCompleto(rotulos, series, {tipo = 'linha', titulo, area = false, altura} = {}){
  const caixa = el('div', {});
  caixa.append(legenda(series), tipo === 'linha' ? graficoLinha(rotulos, series, {titulo, area, altura}) : graficoBarrasGrupo(rotulos, series, {titulo, altura}), verDados(rotulos, series, titulo));
  return caixa;
}
