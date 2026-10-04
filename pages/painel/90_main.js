// ===== navegação, rotas, busca global, modos, tema, impressão =====
const VIEWS = {
  visao: {titulo: 'Visão Geral', sub: 'Centro de comando da unidade judicial', icone: 'home', build: viewVisao, palavras: 'inicio resumo painel kpi atencao alertas'},
  processos: {grupo: 'OPERAÇÃO', titulo: 'Processos', sub: 'Pendentes, paralisados e documentos: busca, filtros e exportação', icone: 'lista', build: viewProcessos, palavras: 'lista pendentes paralisados dias csv busca'},
  tarefas: {grupo: 'OPERAÇÃO', titulo: 'Tarefas PJe', sub: 'Tarefas pendentes no PJe (diário e semanal)', icone: 'lista', build: viewTarefas, palavras: 'pje tarefas pendentes semanal diario dias'},
  conclusoes: {grupo: 'OPERAÇÃO', titulo: 'Conclusões', sub: 'Conclusões PJe + eProc por dia e por mês', icone: 'check', build: viewConclusoes, palavras: 'conclusos concluidos pje eproc ano mes'},
  documentos: {grupo: 'OPERAÇÃO', titulo: 'Documentos', sub: 'Documentos juntados e não lidos', icone: 'doc', build: viewDocumentos, palavras: 'documentos juntados nao lidos'},
  movimentacao: {grupo: 'OPERAÇÃO', titulo: 'Movimentação', sub: 'Distribuídos, baixas e julgamentos por sistema', icone: 'tend', build: viewMovimentacao, palavras: 'distribuicao baixas julgamentos eproc seeu siscom sistema'},
  indicadores: {grupo: 'ESTRATÉGIA', titulo: 'Indicadores', sub: 'Desempenho da unidade e índices', icone: 'barras', build: viewIndicadores, palavras: 'estrategicos desempenho produtividade indices julgamentos baixas distribuicao paralisados'},
  metas: {grupo: 'ESTRATÉGIA', titulo: 'Metas CNJ', sub: 'Metas Nacionais do Poder Judiciário, 1º grau', icone: 'check', build: viewMetas, palavras: 'metas nacionais cnj cumprimento 1 grau meta 1 meta 2 meta 3 meta 4 meta 5 meta 6 meta 7 meta 8 meta 10'},
  acervo: {grupo: 'ESTRATÉGIA', titulo: 'Acervo', sub: 'Evolução do acervo ativo e acervo físico', icone: 'caixa', build: viewAcervo, palavras: 'acervo fisico siscom evolucao'},
  migracao: {grupo: 'MIGRAÇÃO', titulo: 'PJe → eProc', sub: 'Migrador de processos: aptos, inaptos e migrados', icone: 'nuvem', build: viewMigracao, palavras: 'migracao migrador aptos inaptos migrados eproc'},
  apoio: {grupo: 'APOIO', titulo: 'Planejamento', sub: 'Apoio ao planejamento e fiscalização', icone: 'doc', build: viewApoio, palavras: 'apoio planejamento fiscalizacao indicadores gerais'},
};
// compatibilidade com os links/âncoras antigos
const ALIAS = {docs_nao_lidos: 'documentos', tarefas_pje_diario: 'tarefas', tarefas_pje_semanal: 'tarefas', dados_estrategicos: 'indicadores', acervo_fisico: 'acervo', migrador_pje: 'migracao',
  apoio_planejamento: 'apoio', metas_cnj: 'metas', mov_eproc: 'movimentacao', mov_mes_corrente: 'movimentacao', pendentes: 'processos', '': 'visao'};
const construidas = {};
let atualId = null;

function montarNav(){
  const nav = document.getElementById('side'); nav.replaceChildren();
  const grupos = {};
  for (const [id, v] of Object.entries(VIEWS)) (grupos[v.grupo || ''] = grupos[v.grupo || ''] || []).push(id);
  for (const g of Object.keys(grupos)) {
    if (g) nav.append(el('h2', {}, g));
    for (const id of grupos[g]) { const v = VIEWS[id]; nav.append(el('a', {href: '#' + id, 'data-id': id}, ico(v.icone, 18), v.titulo)); }
  }
  // seletor de modo num invólucro próprio: só aparece nas visões que têm blocos .detalhe (ver rota())
  const modo = el('div', {class: 'modo'}, el('div', {id: 'modo-sel'}, el('p', {id: 'modo-t'}, 'MODO'), el('div', {class: 'seg', role: 'group', 'aria-labelledby': 'modo-t'},
    ...[['gerencial', 'Gerencial'], ['detalhado', 'Detalhado']].map(([k, r]) => { const b = el('button', {type: 'button', 'data-modo': k}, r); b.addEventListener('click', () => definirModo(k)); return b; }))),
    el('button', {class: 'btn-lado', type: 'button', id: 'imprimir'}, 'Imprimir tudo'));
  nav.append(modo);
  nav.addEventListener('click', (ev) => { if (ev.target.closest('a')) fecharMenu(); });
  document.getElementById('imprimir').addEventListener('click', () => window.print());
}
function definirModo(m){
  document.body.dataset.modo = m; gravarPref('modo', m);
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
}
function fecharMenu(){ document.getElementById('side').classList.remove('aberto'); document.getElementById('menu-btn').setAttribute('aria-expanded', 'false'); }

function construir(id){
  if (construidas[id]) return construidas[id];
  const v = VIEWS[id], caixa = el('section', {class: 'view', id: 'v-' + id, hidden: true, 'aria-labelledby': 'h-' + id});
  caixa.append(el('div', {class: 'view-head'}, el('div', {}, el('h1', {id: 'h-' + id, tabindex: '-1'}, v.titulo), el('p', {}, v.sub))));
  try { v.build(caixa); } catch (e) { caixa.append(el('p', {class: 'erro', role: 'alert'}, 'Não foi possível montar este módulo: ' + e.message)); console.error(e); }
  document.getElementById('views').append(caixa);
  return (construidas[id] = caixa);
}
function rota(){
  const {id: bruto, params} = hashInfo();
  const id = VIEWS[bruto] ? bruto : (ALIAS[bruto] || 'visao');
  const caixa = construir(id);
  for (const c of document.querySelectorAll('.view')) c.hidden = c !== caixa;
  document.getElementById('modo-sel').hidden = !caixa.querySelector('.detalhe');   // o modo só muda algo onde há blocos .detalhe
  document.querySelectorAll('#side a').forEach(a => { if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = `${VIEWS[id].titulo} · ${D.titulo}`;
  if (id === 'processos' && window.__procAplicar && atualId === 'processos') window.__procAplicar(params);
  if (id !== atualId) { window.scrollTo(0, 0); const h = caixa.querySelector('h1'); if (h) h.focus({preventScroll: true}); }
  atualId = id;
}
window.addEventListener('hashchange', rota);

// impressão: monta e mostra todas as visões
window.addEventListener('beforeprint', () => { for (const id of Object.keys(VIEWS)) construir(id); });

// busca global: módulos e processos
function iniciarBusca(){
  const inp = document.getElementById('gs'), res = document.getElementById('gres');
  let indice = null;
  PROC.then(P => {
    indice = [];
    const add = (fonte, t, nome) => { if (!t) return; const ip = t.colunas.findIndex(c => c === 'Processo' || c === 'Número Feito'), it = t.colunas.findIndex(c => c === 'Tarefa' || c === 'Documento' || c === 'Classe');
      for (const l of t.linhas) indice.push({fonte, nome, proc: l[ip], det: l[it] || '', chave: norm(l.join(' '))}); };
    add('pend', P.pendentes, 'Pendentes'); add('semanal', P.semanal, 'Semanal'); add('docs', P.docs, 'Documentos'); add('metas', P.metas, 'Metas CNJ');
    if (P.apoio) for (const a of P.apoio.abas) add(a.aba, a, a.aba);
  }).catch(() => {});
  const fechar = () => { res.hidden = true; inp.setAttribute('aria-expanded', 'false'); };
  function buscar(){
    const q = norm(inp.value).trim();
    if (q.length < 2) { fechar(); return; }
    res.replaceChildren();
    const mods = Object.entries(VIEWS).filter(([id, v]) => norm(v.titulo + ' ' + v.sub + ' ' + v.palavras).includes(q)).slice(0, 6);
    if (mods.length) { res.append(el('h4', {}, 'Módulos')); for (const [id, v] of mods) { const b = el('button', {type: 'button', role: 'option'}, el('span', {}, v.titulo), el('small', {}, v.grupo || 'Início')); b.addEventListener('click', () => { location.hash = '#' + id; fechar(); inp.value = ''; }); res.append(b); } }
    const ps = indice ? indice.filter(x => x.chave.includes(q)).slice(0, 8) : [];
    if (ps.length) { res.append(el('h4', {}, 'Processos')); for (const x of ps) { const b = el('button', {type: 'button', role: 'option'}, el('span', {}, x.proc), el('small', {}, `${x.nome} · ${String(x.det).slice(0, 40)}`)); b.addEventListener('click', () => { location.hash = link('processos', {fonte: x.fonte, q: x.proc}); fechar(); inp.value = ''; }); res.append(b); } }
    if (!mods.length && !ps.length) res.append(el('h4', {}, indice ? 'Nada encontrado' : 'Carregando a lista de processos…'));
    res.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  inp.addEventListener('input', buscar);
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fechar(); if (ev.key === 'ArrowDown') { const b = res.querySelector('button'); if (b) { ev.preventDefault(); b.focus(); } } if (ev.key === 'Enter') { const b = res.querySelector('button'); if (b) b.click(); } });
  res.addEventListener('keydown', (ev) => { const bs = [...res.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown' && bs[i + 1]) { ev.preventDefault(); bs[i + 1].focus(); } if (ev.key === 'ArrowUp') { ev.preventDefault(); (bs[i - 1] || inp).focus(); } if (ev.key === 'Escape') { fechar(); inp.focus(); } });
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.gsearch')) fechar(); });
}

// ===== partida =====
document.getElementById('lupa').append(ico('busca', 16));
document.getElementById('menu-btn').append(ico('menu', 20));
document.getElementById('menu-btn').addEventListener('click', () => { const s = document.getElementById('side'), aberto = s.classList.toggle('aberto'); document.getElementById('menu-btn').setAttribute('aria-expanded', String(aberto)); });
let temaAtual = lerPref('tema', 'auto'); if (!TEMAS.includes(temaAtual)) temaAtual = 'auto';
aplicarTema(temaAtual);
document.getElementById('tema').addEventListener('click', () => { temaAtual = TEMAS[(TEMAS.indexOf(temaAtual) + 1) % TEMAS.length]; gravarPref('tema', temaAtual); aplicarTema(temaAtual); });
desenharTopo();
montarNav();
definirModo(lerPref('modo', 'detalhado') === 'gerencial' ? 'gerencial' : 'detalhado');
iniciarBusca();
document.getElementById('rodape').textContent = 'Montado em ' + dtHora(D.gerado_em) + ` a partir das coletas feitas neste navegador. Comarca de ${D.comarca}. Os dados e as relações de processos ficam só neste computador.`;
rota();
