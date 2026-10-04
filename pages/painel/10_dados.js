// ===== dados derivados (tudo calculado a partir de D e de processos.json; nada é estimado) =====
// relações de processos: vêm do IndexedDB deste navegador (carregar.js); nunca saem dele
const PROC = window.__P ? Promise.resolve(window.__P) : Promise.reject(new Error('nenhuma relação de processos coletada ainda'));
PROC.catch(() => {});
const M = D.movimentacao, V = D.visao;
const sis = (id) => M.sistemas.find(s => s.id === id);
const serieSis = (id, chave) => { const s = sis(id), x = s && s.series.find(z => z.chave === chave); return x ? x.pontos : []; };   // [{m, v}]
const kpiSis = (id, rotuloIni) => { const s = sis(id), k = s && s.kpis.find(z => z.rotulo.startsWith(rotuloIni)); return k || null; };
// os painéis estratégicos vão até o fim do mês anterior; meses posteriores (parciais) não entram nas comparações
const fimComum = ['pje', 'seeu', 'siscom'].map(i => { const p = serieSis(i, 'julgamentos'); return p.length ? p[p.length - 1].m : null; }).filter(Boolean).sort()[0];
const ateFim = (pontos) => pontos.filter(p => !fimComum || p.m <= fimComum);
const totalSerie = (chave) => ateFim(serieSis('total', chave));
const acervoSerie = ateFim(V.acervo_serie);
function janela(pontos, n, desloc = 0){ const fim = pontos.length - desloc; return pontos.slice(Math.max(0, fim - n), fim); }
const soma = (pts) => pts.reduce((a, p) => a + (p.v || 0), 0);
function comparar(pontos, n){   // período atual (n meses) x período anterior (n meses); só se o anterior estiver completo
  const atual = janela(pontos, n), ant = janela(pontos, n, n);
  if (atual.length < n || ant.length < n) return {atual: soma(atual), anterior: null, delta: null, pct: null, atualPts: atual, antPts: ant};
  const a = soma(atual), b = soma(ant);
  return {atual: a, anterior: b, delta: a - b, pct: b ? (a - b) / b * 100 : null, atualPts: atual, antPts: ant};
}
const mesAtualConcl = (() => { const meses = D.conclusoes.meses.map(m => m.mes).sort(); return meses.length ? D.conclusoes.meses.find(m => m.mes === meses[meses.length - 1]) : null; })();
// parâmetros de deep link: #visao?fonte=...&dias=...
function hashInfo(){ const h = location.hash.slice(1), i = h.indexOf('?'); return {id: i < 0 ? h : h.slice(0, i), params: new URLSearchParams(i < 0 ? '' : h.slice(i + 1))}; }
function link(view, params){ const q = params ? '?' + new URLSearchParams(params).toString() : ''; return '#' + view + q; }
