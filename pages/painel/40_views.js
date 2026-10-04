// ===== visões (módulos) =====
const secao = (id) => D.secoes.find(s => s.id === id);
const kpiDe = (s, ini) => s && s.kpis.find(k => k.rotulo.startsWith(ini));
const serieDe = (s, ini) => s && s.series.find(x => x.rotulo.startsWith(ini));
function atalhosDias(id, rotulo){   // "mais de N dias" com quantidade (preenchido quando a lista de processos carrega)
  const caixa = el('div', {class: 'chips', role: 'group', 'aria-label': rotulo});
  const botoes = FAIXAS_DIAS.map(d => { const a = el('a', {class: 'chip', href: link('processos', {fonte: id, dias: d + 1})}, `> ${d} dias`); caixa.append(a); return [d, a]; });
  const todos = el('a', {class: 'chip', href: link('processos', {fonte: id})}, 'Ver todos'); caixa.append(todos);
  PROC.then(() => { const c = window.__procContagens && window.__procContagens[id]; if (c) { for (const [d, a] of botoes) a.textContent = `> ${d} dias · ${fmt(c[d])}`; todos.textContent = `Ver todos · ${fmt(c[0])}`; } }).catch(() => {});
  return caixa;
}

function viewTarefas(raiz){
  const dia = secao('tarefas_pje_diario'), sem = secao('tarefas_pje_semanal');
  const k1 = kpiDe(dia, 'Tarefas pendentes'), k2 = kpiDe(sem, 'Total de tarefas');
  raiz.append(el('div', {class: 'grid g-kpi'}, k1 && kpiCard({icone: 'lista', rotulo: 'Tarefas pendentes (diário)', valor: k1.texto, href: link('processos', {fonte: 'pend'}), sub: 'abrir lista de processos'}),
    k2 && kpiCard({icone: 'lista', rotulo: 'Tarefas pendentes (semanal)', valor: k2.texto, href: link('processos', {fonte: 'semanal'}), sub: 'posição semanal · abrir lista'})));
  raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'tf-d'}, el('h2', {id: 'tf-d'}, 'Há quanto tempo estão pendentes — diário'), el('p', {class: 'meta'}, 'Escolha uma faixa para abrir a lista já filtrada. "Acima de N" = mais de N dias.'), atalhosDias('pend', 'Faixas do painel diário')));
  raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'tf-s'}, el('h2', {id: 'tf-s'}, 'Há quanto tempo estão pendentes — semanal'), atalhosDias('semanal', 'Faixas do painel semanal')));
  const blocos = [];
  const sTar = serieDe(dia, 'Por tarefa'), sSem = serieDe(sem, 'Por tarefa');
  function topComVerTodas(serie, nome){
    const caixa = el('div', {}), total = serie.pontos.length; let tudo = false;
    const btn = el('button', {class: 'btn', type: 'button'}, `Ver todas (${total})`);
    const desenhar = () => { caixa.replaceChildren(barras({rotulo: serie.rotulo, pontos: serie.pontos, total_itens: serie.pontos.length}, tudo ? null : 10), total > 10 ? btn : null); btn.textContent = tudo ? 'Mostrar só as 10 principais' : `Ver todas (${total})`; };
    btn.addEventListener('click', () => { tudo = !tudo; desenhar(); }); desenhar();
    return el('section', {class: 'card', 'aria-label': nome}, el('h2', {}, nome), caixa);
  }
  raiz.append(el('div', {class: 'grid g-2 mt'}, sTar && topComVerTodas(sTar, 'Principais tarefas — diário'), sSem && topComVerTodas(sSem, 'Principais tarefas — semanal')));
  const det = el('div', {class: 'grid g-2 mt detalhe'});
  for (const x of dia.series.filter(s => !s.rotulo.startsWith('Por tarefa'))) det.append(el('section', {class: 'card'}, barras(x)));
  raiz.append(det, linhaFonte(['tarefas_pje_diario', 'tarefas_pje_semanal']));
}

function viewDocumentos(raiz){
  const s = secao('docs_nao_lidos'), k = kpiDe(s, 'Documentos') || (s && s.kpis[0]);
  raiz.append(el('div', {class: 'grid g-kpi'}, k && kpiCard({icone: 'doc', rotulo: 'Documentos não lidos', valor: k.texto, href: link('processos', {fonte: 'docs'}), sub: 'abrir a lista · exportar CSV'})));
  raiz.append(el('p', {class: 'mt'}, el('a', {class: 'btn pri', href: link('processos', {fonte: 'docs'})}, ico('baixar', 16), 'Abrir a lista de documentos (com exportação CSV)')));
  const g = el('div', {class: 'grid g-2'});
  (s ? s.series : []).forEach((x, i) => g.append(el('section', {class: 'card' + (i ? ' detalhe' : '')}, barras(x))));
  raiz.append(g, linhaFonte(['docs_nao_lidos']));
}

function viewMovimentacao(raiz){
  const c = M.coletas || {};
  const card = el('section', {class: 'card', 'aria-labelledby': 'mv-t'}, el('h2', {id: 'mv-t'}, 'Movimentação por sistema'),
    el('p', {class: 'meta'}, 'Distribuídos, baixas e julgamentos por mês, separados por sistema, com o total de todos.'));
  const abas = el('div', {class: 'chips', role: 'group', 'aria-label': 'Sistema'}), corpo = el('div', {});
  card.append(abas, corpo); raiz.append(card);
  function desenhar(s){
    corpo.replaceChildren(); abas.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === s.id)));
    if (s.nota) corpo.append(el('p', {class: 'meta'}, s.nota));
    if (s.kpis.length) corpo.append(kpis(s.kpis));
    const grid = el('div', {class: 'grid g-1 mt'});
    for (const sr of s.series) grid.append(el('div', {}, el('h3', {}, sr.rotulo), graficoCompleto(sr.pontos.map(p => mesRot(p.m)), [{nome: sr.rotulo, valores: sr.pontos.map(p => p.v)}], {titulo: sr.rotulo + ' (' + s.nome + ')', tipo: 'barras', altura: 200})));
    corpo.append(grid);
    if (!s.series.length) corpo.append(el('p', {class: 'meta'}, 'Sem série mensal coletada.'));
  }
  for (const s of M.sistemas) { const b = el('button', {type: 'button', class: 'chip', 'data-id': s.id}, s.nome); b.addEventListener('click', () => desenhar(s)); abas.append(b); }
  if (M.sistemas.length) desenhar(M.sistemas[0]);
  raiz.append(el('p', {class: 'meta'}, `eProc coletado ${ha(c.eproc)}; PJe, SEEU e SISCOM ${ha(c.pje_seeu_siscom)}` + (M.carimbos && M.carimbos.pje_seeu_siscom ? ` (painel: ${M.carimbos.pje_seeu_siscom})` : '') + '.'), linhaFonte(['mov_eproc', 'dados_estrategicos', 'mov_mes_corrente']));
}

function viewConclusoes(raiz){
  const C = D.conclusoes, f = C.fontes;
  if (!C.meses.length) { raiz.append(el('p', {class: 'erro'}, 'Ainda sem dados de conclusões.')); return; }
  const meses = C.meses.map(m => m.mes).sort().reverse(), anos = [...new Set(meses.map(m => m.slice(0, 4)))];
  const cart = el('div', {class: 'grid g-kpi'}), ult = C.dias.length ? C.dias[C.dias.length - 1] : null;
  if (ult) cart.append(el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Último dia com dados · ' + dataBR(ult.data)), el('span', {class: 'v'}, fmt(ult.total)), el('span', {class: 's'}, `PJe ${fmt(ult.pje)} · eProc ${fmt(ult.eproc)}`)));
  for (const mes of meses.slice(0, 2)) { const m = C.meses.find(x => x.mes === mes); cart.append(el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, mesLongo(mes) + ' · total'), el('span', {class: 'v'}, fmt(m.total)), el('span', {class: 's'}, `PJe ${fmt(m.pje)} · eProc ${fmt(m.eproc)}`))); }
  raiz.append(cart);
  const card = el('section', {class: 'card mt', 'aria-labelledby': 'cc-t'}); raiz.append(card);
  const selAno = el('select', {'aria-label': 'Ano'}, el('option', {value: '6m'}, 'Últimos 6 meses'), el('option', {value: 'todos'}, 'Todo o período'), ...anos.map(a => el('option', {value: a}, a)));
  const selMes = el('select', {'aria-label': 'Mês', disabled: true}, el('option', {value: ''}, 'Todos os meses'), ...MES.map((n, i) => el('option', {value: String(i + 1).padStart(2, '0')}, n)));
  card.append(el('header', {}, el('h2', {id: 'cc-t'}, 'Conclusões — PJe + eProc'), el('div', {class: 'filtros', style: 'margin:0'}, el('b', {}, 'Período:'), selAno, selMes)),
    el('p', {class: 'meta'}, 'Total diário e mensal por sistema (contagem de eventos de conclusão).' + (M.eproc_inicio ? ` O eProc entra a partir de ${mesRot(M.eproc_inicio)}, primeiro mês com movimentação no painel do eProc.` : '')));
  const blocoMes = el('div', {}), blocoDia = el('div', {}), selDia = el('select', {'aria-label': 'Mês do detalhe diário'});
  card.append(blocoMes, el('h3', {}, 'Por dia'), el('div', {class: 'filtros'}, el('span', {class: 'meta', style: 'margin:0'}, 'Mês do detalhe diário:'), selDia), blocoDia);
  const tot = (rot, a, b, c) => el('tr', {class: 'tot'}, el('th', {scope: 'row'}, rot), el('td', {}, fmt(a)), el('td', {}, fmt(b)), el('td', {}, fmt(c)));
  function filtroMeses(){ const a = selAno.value, mm = selMes.value; let L = meses.slice(); if (a === '6m') L = L.slice(0, 6); else if (a !== 'todos') { L = L.filter(m => m.startsWith(a)); if (mm) L = L.filter(m => m.endsWith('-' + mm)); } return L; }
  function pilha(itens, rotulo, leg){ return graficoBarrasGrupo(itens.map(leg), [{nome: 'PJe', valores: itens.map(d => d.pje)}, {nome: 'eProc', valores: itens.map(d => d.eproc)}], {titulo: rotulo}); }
  function desenharMeses(){
    blocoMes.replaceChildren(); const L = filtroMeses();
    if (!L.length) { blocoMes.append(el('p', {class: 'meta'}, 'Nenhum mês neste período.')); return; }
    const d = L.slice().reverse().map(mes => { const m = C.meses.find(x => x.mes === mes); return {mes, pje: m.pje, eproc: m.eproc, total: m.total}; });
    const T = d.reduce((s, x) => ({pje: s.pje + x.pje, eproc: s.eproc + x.eproc, total: s.total + x.total}), {pje: 0, eproc: 0, total: 0});
    blocoMes.append(el('h3', {}, 'Por mês'), legenda([{nome: 'PJe'}, {nome: 'eProc'}]), pilha(d, 'Conclusões por mês', x => mesRot(x.mes)));
    const t = el('table', {class: 'num'}, el('caption', {class: 'vh'}, 'Conclusões por mês'), el('thead', {}, el('tr', {}, ...['Mês', 'PJe', 'eProc', 'Total'].map(h => el('th', {scope: 'col'}, h)))));
    t.append(el('tbody', {}, tot(`TOTAL (${d.length} ${d.length > 1 ? 'meses' : 'mês'})`, T.pje, T.eproc, T.total), ...d.slice().reverse().map(x => el('tr', {}, el('th', {scope: 'row'}, mesRot(x.mes)), el('td', {}, fmt(x.pje)), el('td', {}, fmt(x.eproc)), el('td', {}, fmt(x.total))))));
    blocoMes.append(el('div', {class: 'rolagem'}, t));
    selDia.replaceChildren(...L.map(m => el('option', {value: m}, mesLongo(m)))); desenharDias(selDia.value);
  }
  function desenharDias(mes){
    blocoDia.replaceChildren(); if (!mes) return;
    const doMes = C.dias.filter(d => d.data.startsWith(mes)), mapa = Object.fromEntries(doMes.map(d => [d.data, d])), ultimo = doMes.length ? +doMes[doMes.length - 1].data.slice(8) : 0, dias = [];
    for (let d = 1; d <= ultimo; d++) { const iso = `${mes}-${String(d).padStart(2, '0')}`; dias.push(mapa[iso] || {data: iso, pje: 0, eproc: 0, total: 0}); }
    const mt = C.meses.find(x => x.mes === mes);
    if (!dias.length) { blocoDia.append(el('p', {class: 'meta'}, 'Sem conclusões registradas neste mês até a data de referência.')); return; }
    blocoDia.append(legenda([{nome: 'PJe'}, {nome: 'eProc'}]), pilha(dias, 'Conclusões por dia', d => String(+d.data.slice(8))));
    const t = el('table', {class: 'num'}, el('caption', {class: 'vh'}, 'Conclusões por dia'), el('thead', {}, el('tr', {}, ...['Dia', 'PJe', 'eProc', 'Total'].map(h => el('th', {scope: 'col'}, h)))));
    const tb = el('tbody', {});
    if (mt) { tb.append(tot('TOTAL DO MÊS', mt.pje, mt.eproc, mt.total), el('tr', {class: 'sub'}, el('th', {scope: 'row'}, 'Processos distintos'), el('td', {}, fmt(mt.pje_proc)), el('td', {}, fmt(mt.eproc_proc)), el('td', {}, '—'))); }
    for (const d of [...dias].reverse()) tb.append(el('tr', {}, el('th', {scope: 'row'}, dataBR(d.data)), el('td', {}, fmt(d.pje)), el('td', {}, fmt(d.eproc)), el('td', {}, fmt(d.total))));
    t.append(tb); blocoDia.append(el('div', {class: 'rolagem detalhe-tab'}, t));
  }
  selAno.addEventListener('change', () => { selMes.disabled = ['6m', 'todos'].includes(selAno.value); if (selMes.disabled) selMes.value = ''; desenharMeses(); });
  selMes.addEventListener('change', desenharMeses); selDia.addEventListener('change', () => desenharDias(selDia.value));
  desenharMeses();
  raiz.append(el('p', {class: 'meta'}, C.nota + (f.pje ? ` PJe: coletado ${ha(f.pje.coletada_em)}, referência ${f.pje.referencia || '—'}.` : '') + (f.eproc ? ` eProc: coletado ${ha(f.eproc.coletada_em)}.` : '')));
}

function viewIndicadores(raiz){
  raiz.append(desempenho({faixas: [24, 12, 6, 3], padrao: 24}));
  const par = [['Paralisados > 60 dias', V.paralisados_60], ['Paralisados > 100 dias', V.paralisados_100], ['Paralisados > 120 dias', V.paralisados_120], ['Índice de baixas', V.indice_baixas], ['Índice de julgamentos', V.indice_julgamentos]].filter(x => x[1]);
  raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'ix-t'}, el('h2', {id: 'ix-t'}, 'Paralisados e índices'),
    el('div', {class: 'grid g-kpi mt'}, ...par.map(([r, v]) => el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, r), el('span', {class: 'v'}, v.texto)))),
    el('p', {class: 'meta'}, 'Paralisados: PJe, sem motivo legal. Índices: baixas ÷ distribuídos e julgamentos ÷ distribuídos (PJe + SEEU + SISCOM). Sem metas oficiais nos dados, não há avaliação de bom ou ruim.'),
    el('p', {}, el('a', {class: 'btn', href: link('movimentacao')}, 'Ver movimentação por sistema'))), linhaFonte(['dados_estrategicos', 'mov_eproc']));
}

function viewAcervo(raiz){
  const at = V.acervo_total, ea = V.eproc_acervo;
  if (at) raiz.append(el('section', {class: 'card', 'aria-labelledby': 'at-t'}, el('h2', {id: 'at-t'}, 'Acervo ativo — total líquido'),
    el('div', {class: 'grid g-kpi mt'}, kpiCard({icone: 'doc', rotulo: 'Acervo ativo (total líquido)', valor: at.texto, sub: `${at.pje_seeu_siscom.texto} + ${fmt(at.eproc.numero)} − ${at.descontados_texto}`}),
      kpiCard({icone: 'caixa', rotulo: 'PJe + SEEU + SISCOM', valor: at.pje_seeu_siscom.texto, sub: 'posição do fim de ' + mesLongo(at.base_pje)}),
      kpiCard({icone: 'caixa', rotulo: 'eProc', valor: fmt(at.eproc.numero), sub: 'posição de ' + dataBR(at.data_eproc) + ' (atualizado diariamente)'}),
      kpiCard({icone: 'alerta', rotulo: 'Descontados (migrados)', valor: at.descontados_texto, sub: 'migrados após ' + mesLongo(at.base_pje) + ', contados no PJe e no eProc'})),
    el('p', {class: 'meta'}, `Total líquido = (PJe + SEEU + SISCOM em ${mesLongo(at.base_pje)}) + (eProc em ${dataBR(at.data_eproc)}) − processos migrados ao eProc depois de ${mesLongo(at.base_pje)}, que já estavam no acervo do PJe naquela data e hoje estão no do eProc (soma bruta: ${at.bruto_texto}). As datas-base diferem porque o painel do PJe é fechado no fim do mês e o eProc é atualizado todo dia; não há reconstituição exata do acervo do eProc em data passada (há trânsito entre unidades), então nada é estimado além desse desconto.`),
    el('div', {class: 'grid g-kpi'}, ...[['PJe', kpiSis('pje', 'Acervo')], ['SEEU', kpiSis('seeu', 'Acervo')], ['SISCOM (físicos)', kpiSis('siscom', 'Acervo')]].filter(x => x[1]).map(([r, v]) => kpiCard({icone: 'caixa', rotulo: 'Acervo ' + r, valor: v.texto, sub: 'fim de ' + mesLongo(fimComum || at.base_pje)})))));
  const rot = acervoSerie.map(p => mesRot(p.m));
  raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'ac-t'}, el('h2', {id: 'ac-t'}, 'Evolução do acervo — PJe + SEEU + SISCOM'),
    graficoCompleto(rot, [{nome: 'Acervo ativo (PJe+SEEU+SISCOM)', valores: acervoSerie.map(p => p.v)}], {titulo: 'Evolução do acervo ativo', area: true, altura: 230}),
    el('p', {class: 'meta'}, 'Processos migrados do PJe para o eProc saem desta série e passam a constar no bloco do eProc' + (M.eproc_inicio ? ` (a comarca tem movimentação no eProc desde ${mesRot(M.eproc_inicio)})` : '') + '; quedas no período de migração refletem essa transferência.')));
  if (ea) {
    const corpo = el('section', {class: 'card mt', 'aria-labelledby': 'ep-t'}, el('h2', {id: 'ep-t'}, 'Acervo do eProc'),
      el('p', {class: 'meta'}, `Painel de movimentação do eProc, coletado ${ha(ea.coletada_em)}${ea.carimbo ? ' (painel: ' + ea.carimbo + ')' : ''}. Acervo = processos marcados como acervo (ACERVO=1).`), kpis(ea.kpis));
    const g = el('div', {class: 'grid g-2 mt'});
    if (ea.por_classe.length) g.append(barras({rotulo: 'Acervo por classe', pontos: ea.por_classe, total_itens: ea.total_classes}));
    if (ea.migrados_mes.length) g.append(el('div', {}, el('h3', {}, 'Processos migrados do PJe, por mês'), graficoCompleto(ea.migrados_mes.map(p => mesRot(p.m)), [{nome: 'Migrados no mês', valores: ea.migrados_mes.map(p => p.v)}], {tipo: 'barras', titulo: 'Processos migrados por mês', altura: 180})));
    corpo.append(g); raiz.append(corpo);
  }
  const comp = ['pje', 'seeu', 'siscom'].map(id => ({id, nome: sis(id).nome, pts: ateFim(serieSis(id, 'acervo'))})).filter(x => x.pts.length);
  if (comp.length) raiz.append(el('section', {class: 'card mt detalhe', 'aria-labelledby': 'ac2-t'}, el('h2', {id: 'ac2-t'}, 'Acervo por sistema (fim de cada mês)'),
    el('div', {class: 'grid g-1'}, ...comp.map(x => el('div', {}, el('h3', {}, x.nome), graficoCompleto(x.pts.map(p => mesRot(p.m)), [{nome: x.nome, valores: x.pts.map(p => p.v)}], {titulo: 'Acervo ao fim de cada mês: ' + x.nome, altura: 200}))))));
  const fis = secao('acervo_fisico');
  if (fis) raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'fi-t'}, el('h2', {id: 'fi-t'}, 'Acervo de processos físicos'), kpis(fis.kpis), ...fis.series.map(x => barras(x))), linhaFonte(['acervo_fisico']));
  raiz.append(linhaFonte(['dados_estrategicos', 'mov_eproc']));
}

function viewMigracao(raiz){
  const g = (r, v, ic) => v && kpiCard({icone: ic, rotulo: r, valor: v.texto});
  raiz.append(el('div', {class: 'grid g-kpi'}, g('Total no migrador', V.migracao_total, 'lista'), g('Migrados', V.migrados, 'nuvem'), g('Aptos', V.aptos, 'upload'), g('Inaptos', V.inaptos, 'alerta')));
  raiz.append(el('p', {class: 'meta mt'}, 'Migrados, aptos e inaptos são categorias do painel do migrador e não são exclusivas entre si (a soma não corresponde ao total). Por isso não se calcula percentual de conclusão da migração. O painel de movimentação do eProc mostra ' + ((kpiSis('eproc', 'Migrados') || {}).texto || '—') + ' migrados, com data de corte diferente.'));
  const ms = V.migracao_series, grid = el('div', {class: 'grid g-3 mt'});
  [['Aptos por unidade', ms.aptos_por_unidade], ['Inaptos por órgão', ms.inaptos_por_orgao], ['Migrados por órgão', ms.migrados_por_orgao]].forEach(([r, p]) => { if (p && p.length) grid.append(el('section', {class: 'card'}, barras({rotulo: r, pontos: p.map(x => ({r: x.r, v: x.v}))}))); });
  raiz.append(grid);
  const cx = el('section', {class: 'card mt', 'aria-labelledby': 'mt-t'}, el('h2', {id: 'mt-t'}, 'Tarefas de migração no PJe'), el('p', {class: 'meta'}, 'Tarefas do painel diário de tarefas pendentes que tratam de migração. Carregando…'));
  raiz.append(cx);
  PROC.then(P => {
    const c = P.pendentes.colunas, iT = c.indexOf('Tarefa'), cont = new Map();
    for (const l of P.pendentes.linhas) if (/migra/i.test(l[iT])) cont.set(l[iT], (cont.get(l[iT]) || 0) + 1);
    cx.querySelector('p.meta').textContent = 'Tarefas do painel diário de tarefas pendentes que tratam de migração (processos com tarefa pendente). Clique para abrir a lista.';
    cx.append(el('div', {class: 'grid g-kpi'}, ...[...cont.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => kpiCard({icone: 'alerta', rotulo: t, valor: fmt(n), href: link('processos', {fonte: 'pend', tarefa: t}), sub: 'ver processos'}))));
  }).catch(() => { cx.remove(); });
  raiz.append(linhaFonte(['migrador_pje', 'tarefas_pje_diario']));
}

function viewApoio(raiz){
  const s = secao('apoio_planejamento');
  raiz.append(el('section', {class: 'card', 'aria-labelledby': 'ap-t'}, el('h2', {id: 'ap-t'}, 'Indicadores gerais'),
    el('p', {class: 'meta'}, s && s.referencia ? `Mês de referência: ${s.referencia} (posição do fim do mês; o painel é atualizado mensalmente).` : ''),
    s && s.tabela ? tabelaSimples([s.tabela.rotulo, ...s.tabela.colunas], s.tabela.linhas, 'Indicadores gerais do apoio ao planejamento') : el('p', {class: 'meta'}, 'Sem dados coletados.')));
  raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'ap2-t'}, el('h2', {id: 'ap2-t'}, 'Listas de processos do planejamento'),
    el('p', {class: 'meta'}, 'Conclusos e paralisados, sem o que já consta nas tarefas pendentes do painel diário.'),
    el('div', {class: 'chips'}, ...['Paral. >120 dias', 'Paral. >100 dias', 'Concl. Despacho', 'Concl. Decisão', 'Concl. Sentença', 'SML Secretaria', 'SML Gabinete', 'CML (motivo legal)'].map(n => el('a', {class: 'chip', href: link('processos', {fonte: n})}, n)))), linhaFonte(['apoio_planejamento']));
}

// ===== Metas Nacionais do CNJ (1º grau) =====
const STATUS_META = {cumprida: ['badge ok', '✔', 'Meta cumprida (100% ou mais)'], quase: ['badge aten', '●', 'Entre 90% e 99,99%'], abaixo: ['badge crit', '▼', 'Abaixo de 90%'], sem_dados: ['badge', '—', 'Sem processos da meta na comarca']};
function seloMeta(st){ const [c, ic, t] = STATUS_META[st]; return el('span', {class: c}, el('span', {'aria-hidden': 'true'}, ic), ' ' + t); }
const pctTxt = (v) => v == null ? '—' : fmt1(v) + '%';
// avaliações = metas sem sub-aba + cada sub-aba das metas que têm (Meta 2, 4, 7, 8)
function avaliacoesMetas(){
  const L = [];
  for (const m of D.metas.metas) {
    if (m.subs && m.subs.length) m.subs.forEach(sb => L.push({meta: m, sub: sb, rotulo: `${m.nome} · ${sb.rotulo}`, cumprimento: sb.cumprimento, pct: sb.pct, status: sb.status}));
    else L.push({meta: m, sub: null, rotulo: m.nome, cumprimento: m.cumprimento, pct: m.pct, status: m.status});
  }
  return L;
}
function blocoAvaliacao(m, x, dest){   // x = meta (sem sub) ou sub-aba: cumprimento, números, evolução e unidades
  const MT = D.metas;
  if (x.status === 'sem_dados') { dest.append(el('p', {}, 'A comarca não tem processos desta ' + (x === m ? 'meta' : 'sub-aba') + ' no painel.')); return; }
  const topo = el('div', {class: 'grid g-3'});
  topo.append(el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Cumprimento'), el('span', {class: 'v'}, x.cumprimento || '—'), seloMeta(x.status), el('span', {class: 's'}, 'valor do painel, posição de ' + (MT.carimbo || '—'))));
  if (x.numeros.length) topo.append(el('div', {class: 'sub-card'}, el('h3', {}, 'Números'), el('div', {class: 'rows'}, ...x.numeros.map(n => el('div', {}, el('span', {}, n.rotulo), el('b', {}, n.texto))))));
  dest.append(topo);
  const g = el('div', {class: 'grid g-2 mt'});
  if (x.evolucao.length) g.append(el('div', {}, el('h3', {}, 'Evolução mensal do cumprimento'), graficoCompleto(x.evolucao.map(p => p.r.replace(/\/20(\d\d)$/, '/$1')), [{nome: 'Cumprimento (%)', valores: x.evolucao.map(p => p.v)}], {titulo: `Evolução do cumprimento: ${m.nome}${x === m ? '' : ' · ' + x.rotulo}`, formato: pctTxt, altura: 180})));
  if (x.varas.length) g.append(el('div', {}, barras({rotulo: 'Cumprimento por unidade', pontos: x.varas, formato: pctTxt})));
  dest.append(g);
}
function viewMetas(raiz){
  const MT = D.metas;
  if (!MT) { raiz.append(el('p', {class: 'erro'}, 'Painel de metas ainda não coletado.')); return; }
  const AV = avaliacoesMetas(), cont = {cumprida: 0, quase: 0, abaixo: 0, sem_dados: 0};
  AV.forEach(x => cont[x.status]++);
  const resumo = el('section', {class: 'card', 'aria-labelledby': 'mt-r'}, el('h2', {id: 'mt-r'}, 'Resumo das metas'),
    el('p', {class: 'meta'}, `${cont.cumprida} cumprida(s) · ${cont.quase} entre 90% e 99,99% · ${cont.abaixo} abaixo de 90% · ${cont.sem_dados} sem processos na comarca (contando as sub-abas das Metas 2, 4, 7 e 8). Faixas usadas pelo próprio painel; valores do painel de Metas Nacionais do CNJ (posição de ${MT.carimbo || '—'}, atualização mensal).`));
  const t = el('table', {class: 'num'}, el('caption', {class: 'vh'}, 'Cumprimento por meta e sub-aba'), el('thead', {}, el('tr', {}, ...['Meta', 'Assunto', 'Cumprimento', 'Situação'].map(h => el('th', {scope: 'col'}, h)))));
  t.append(el('tbody', {}, ...AV.map(x => el('tr', {}, el('th', {scope: 'row'}, el('a', {href: '#metas-' + x.meta.n, onclick: `document.getElementById('meta-${x.meta.n}').scrollIntoView({behavior:'smooth'});return false;`}, x.rotulo)),
    el('td', {style: 'text-align:left'}, x.meta.titulo), el('td', {}, x.cumprimento || '—'), el('td', {style: 'text-align:left'}, seloMeta(x.status))))));
  resumo.append(el('div', {class: 'rolagem'}, t), el('p', {class: 'mt'}, el('a', {class: 'btn pri', href: link('processos', {fonte: 'metas'})}, ico('baixar', 16), 'Processos pendentes das metas (lista e exportação CSV)')));
  raiz.append(resumo);
  for (const m of MT.metas) {
    const card = el('section', {class: 'card mt', id: 'meta-' + m.n, 'aria-labelledby': 'mh-' + m.n});
    card.append(el('header', {}, el('h2', {id: 'mh-' + m.n}, `${m.nome}: ${m.titulo}`), seloMeta(m.status)));
    if (m.descricao) card.append(el('p', {class: 'meta'}, m.descricao));
    if (m.subs && m.subs.length) {
      const abas = el('div', {class: 'chips', role: 'group', 'aria-label': `Sub-abas da ${m.nome}`}), corpo = el('div', {});
      const mostrar = (sb) => { corpo.replaceChildren(); abas.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.k === sb.k))); blocoAvaliacao(m, sb, corpo); };
      for (const sb of m.subs) { const b = el('button', {type: 'button', class: 'chip', 'data-k': sb.k}, `${sb.rotulo} · ${sb.cumprimento || '—'}`); b.addEventListener('click', () => mostrar(sb)); abas.append(b); }
      card.append(abas, corpo); mostrar(m.subs.find(x => x.status !== 'sem_dados') || m.subs[0]);
    } else blocoAvaliacao(m, m, card);
    raiz.append(card);
  }
  raiz.append(el('p', {class: 'meta'}, 'Os textos das metas são os do painel. Cumprimento = resultado ÷ meta, calculado pelo painel de origem; os "números" usam as mesmas expressões do painel (conferidas: recalculam o cumprimento exibido). As Metas 2, 4, 7 e 8 têm sub-abas escolhidas por uma variável do painel; cada sub-aba é coletada separadamente.'), linhaFonte(['metas_cnj']));
}
