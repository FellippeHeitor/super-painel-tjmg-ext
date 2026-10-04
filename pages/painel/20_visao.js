// ===== Desempenho da unidade (reutilizado na Visão Geral e em Estratégia) =====
function desempenho({faixas = [12, 6, 3], padrao = 12} = {}){
  let n = padrao;
  const card = el('section', {class: 'card', 'aria-labelledby': 'dsp-t'});
  const tabs = el('div', {class: 'tabs', role: 'group', 'aria-label': 'Período do gráfico'});
  card.append(el('header', {}, el('h2', {id: 'dsp-t'}, 'Desempenho da unidade'), tabs));
  card.append(el('p', {class: 'meta'}, `Dados dos painéis estratégicos até ${mesLongo(fimComum || '2000-01')} (posição do fim do mês). Produtividade = soma de eProc, PJe, SEEU e SISCOM. O gráfico de acervo é de PJe + SEEU + SISCOM; o acervo do eProc (${V.acervo_eproc ? fmt(V.acervo_eproc.numero) : '—'}) está na tela Acervo.`));
  const corpo = el('div', {}); card.append(corpo);
  function desenhar(){
    tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.n === n)));
    corpo.replaceChildren();
    const ac = janela(acervoSerie, n), rot = ac.map(p => mesRot(p.m));
    const ini = ac[0], fim = ac[ac.length - 1], pct = ini && ini.v ? (fim.v - ini.v) / ini.v * 100 : null;
    const esq = el('div', {}, el('h3', {}, 'Evolução do acervo ativo'), graficoCompleto(rot, [{nome: 'Acervo ativo', valores: ac.map(p => p.v)}], {titulo: 'Evolução do acervo ativo', area: true}),
      el('div', {class: 'mini'},
        el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Início do período'), el('span', {class: 'v'}, fmt(ini.v)), el('span', {class: 's'}, mesLongo(ini.m))),
        el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Atual'), el('span', {class: 'v'}, fmt(fim.v)), el('span', {class: 's'}, mesLongo(fim.m))),
        el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Variação no período'), el('span', {class: 'v'}, tendHtml(pct == null ? null : {pct})), el('span', {class: 's'}, `${mesRot(ini.m)} → ${mesRot(fim.m)}`))));
    const J = janela(totalSerie('julgamentos'), n), B = janela(totalSerie('baixas'), n), Di = janela(totalSerie('distribuidos'), n);
    const meses = [...new Set([...J, ...B, ...Di].map(p => p.m))].sort();
    const val = (pts) => meses.map(m => { const x = pts.find(p => p.m === m); return x ? x.v : null; });
    const dir = el('div', {}, el('h3', {}, 'Produtividade'), graficoCompleto(meses.map(mesRot), [{nome: 'Julgamentos', valores: val(J)}, {nome: 'Baixas', valores: val(B)}, {nome: 'Distribuições', valores: val(Di)}], {tipo: 'barras', titulo: 'Julgamentos, baixas e distribuições por mês'}));
    corpo.append(el('div', {class: 'grid g-2'}, esq, dir));
    // tendência: período atual x anterior (só quando o anterior está completo)
    const tcards = el('div', {class: 'mini'});
    for (const [rotulo, chave] of [['Julgamentos', 'julgamentos'], ['Baixas', 'baixas'], ['Distribuições', 'distribuidos']]) {
      const c = comparar(totalSerie(chave), n);
      tcards.append(el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, rotulo), el('span', {class: 'v'}, fmt(c.atual)),
        c.anterior == null ? el('span', {class: 's'}, 'sem período anterior comparável') : el('span', {}, tendHtml(c.pct == null ? null : {pct: c.pct}), el('span', {class: 's'}, ` (${c.delta > 0 ? '+' : ''}${fmt(c.delta)} vs ${fmt(c.anterior)} nos ${n} meses anteriores)`))));
    }
    corpo.append(el('h3', {}, `Tendência: últimos ${n} meses x ${n} meses anteriores`), tcards,
      el('p', {class: 'meta'}, 'A variação só é calculada quando existe o período anterior completo. Sem juízo de valor: aumento ou queda não significa melhora ou piora por si só.'));
  }
  for (const f of faixas) { const b = el('button', {type: 'button', 'data-n': f}, `${f} meses`); b.addEventListener('click', () => { n = f; desenhar(); }); tabs.append(b); }
  desenhar();
  return card;
}

// ===== Visão Geral =====
function viewVisao(raiz){
  const acv = V.acervo, tar = V.tarefas_pendentes, p100 = V.paralisados_100, p120 = V.paralisados_120, mig = V.migrados, apt = V.aptos;
  const dAcervo = (() => { const s = acervoSerie; if (s.length < 2) return null; const a = s[s.length - 1].v, b = s[s.length - 2].v; return {pct: b ? (a - b) / b * 100 : null, rotulo: 'vs mês anterior'}; })();
  const cartoes = [];
  const at = V.acervo_total;
  if (at) cartoes.push(kpiCard({icone: 'doc', rotulo: 'Acervo ativo (total líquido)', valor: at.texto, href: link('acervo'), ariaLabel: `Acervo ativo total líquido ${at.texto}. Abrir acervo`,
    sub: `PJe+SEEU+SISCOM ${at.pje_seeu_siscom.texto} (fim de ${mesRot(at.base_pje)}) + eProc ${fmt(at.eproc.numero)} (${dataBR(at.data_eproc)})` + (at.descontados ? ` − ${at.descontados_texto} migrados contados nos dois` : '') + '.'}));
  else if (acv) cartoes.push(kpiCard({icone: 'doc', rotulo: 'Acervo ativo', valor: acv.texto, tend: tendHtml(dAcervo), href: link('acervo'), sub: 'PJe+SEEU+SISCOM'}));
  if (tar) cartoes.push(kpiCard({icone: 'lista', rotulo: 'Tarefas pendentes', valor: tar.texto, tend: tendHtml(tar.tendencia), href: link('tarefas'), sub: 'tarefas do PJe (diário)'}));
  if (p100) cartoes.push(kpiCard({icone: 'relogio', rotulo: 'Paralisados >100 dias', valor: p100.texto, classe: 'warn', tend: tendHtml(p100.tendencia), href: link('processos', {fonte: 'Paral. >100 dias'}), sub: 'sem motivo legal, em Secretaria · ver processos'}));
  if (p120) cartoes.push(kpiCard({icone: 'alerta', rotulo: 'Paralisados >120 dias', valor: p120.texto, classe: 'crit', tend: tendHtml(p120.tendencia), href: link('processos', {fonte: 'Paral. >120 dias'}), sub: 'sem motivo legal, em Secretaria · ver processos'}));
  if (mig) cartoes.push(kpiCard({icone: 'nuvem', rotulo: 'Migrados', valor: mig.texto, tend: tendHtml(mig.tendencia), href: link('migracao'), sub: 'processos migrados do PJe para o eProc'}));
  if (apt) cartoes.push(kpiCard({icone: 'upload', rotulo: 'Aptos para migração', valor: apt.texto, tend: tendHtml(apt.tendencia), href: link('migracao'), sub: 'processos aptos no migrador'}));
  raiz.append(el('div', {class: 'grid g-kpi', role: 'list', 'aria-label': 'Indicadores principais'}, ...cartoes));

  // ---- atenção: só regras explícitas sobre os dados existentes ----
  const aten = el('section', {class: 'atencao mt', 'aria-labelledby': 'aten-t'});
  aten.append(el('header', {}, ico('alerta', 22), el('h2', {id: 'aten-t'}, 'Atenção'), el('span', {class: 'meta', style: 'margin:0;font-weight:400'}, 'Itens que merecem análise (critérios explícitos, sem juízo de mérito)')));
  const caixa = el('div', {class: 'alertas'}); aten.append(caixa);
  const alerta = (nivel, numero, texto, criterio, href, rotuloBotao) => caixa.append(el('div', {class: 'alerta ' + nivel}, el('span', {class: 'selo'}, {crit: 'Crítico', warn: 'Atenção', info: 'Informação'}[nivel]),
    el('span', {class: 'n'}, numero), el('span', {class: 't'}, texto), el('span', {class: 'meta', style: 'margin:0'}, criterio), el('a', {class: 'btn', href}, rotuloBotao)));
  if (p120 && p120.numero > 0) alerta('crit', p120.texto, 'processos paralisados há mais de 120 dias', 'Paralisados sem motivo legal em Secretaria', link('processos', {fonte: 'Paral. >120 dias'}), 'Ver processos');
  if (p100 && p100.numero > 0) alerta('warn', p100.texto, 'processos paralisados há mais de 100 dias', 'Inclui os de mais de 120 dias', link('processos', {fonte: 'Paral. >100 dias'}), 'Ver processos');
  const alDocs = el('span', {}), alTar = el('span', {});
  if (V.docs_nao_lidos && V.docs_nao_lidos.numero > 0) alerta('info', V.docs_nao_lidos.texto, 'documentos juntados e não lidos', 'Total de documentos no painel', link('documentos'), 'Ver documentos');
  if (V.inaptos && V.inaptos.numero > 0) alerta('info', V.inaptos.texto, 'processos inaptos para migração', 'Categorias do migrador não são exclusivas', link('migracao'), 'Ver migração');
  if (D.metas) { const ab = avaliacoesMetas().filter(m => m.status === 'abaixo').length;
    if (ab) alerta('warn', String(ab), ab > 1 ? 'metas (ou sub-abas) do CNJ abaixo de 90% de cumprimento' : 'meta (ou sub-aba) do CNJ abaixo de 90% de cumprimento', 'Faixa usada pelo painel de Metas; atualização mensal', link('metas'), 'Ver metas'); }
  const slotTarefas = el('div', {class: 'alerta info'}); caixa.append(slotTarefas); slotTarefas.hidden = true;
  raiz.append(aten);

  // ---- resumo operacional PJe x eProc ----
  const e = (id, ini) => kpiSis(id, ini);
  const linhas = (pares) => el('div', {class: 'rows'}, ...pares.filter(Boolean).map(([r, v]) => el('div', {}, el('span', {}, r), el('b', {}, v))));
  const pjeCard = el('div', {class: 'sub-card'}, el('h3', {}, 'PJe'), linhas([
    tar && ['Tarefas pendentes', tar.texto], mesAtualConcl && [`Conclusões em ${mesLongo(mesAtualConcl.mes)}`, fmt(mesAtualConcl.pje)],
    V.docs_nao_lidos && ['Documentos não lidos', V.docs_nao_lidos.texto], p100 && ['Paralisados >100 dias', p100.texto],
    kpiSis('pje', 'Entradas') && ['Entradas no mês corrente', kpiSis('pje', 'Entradas').texto], kpiSis('pje', 'Saídas') && ['Saídas no mês corrente', kpiSis('pje', 'Saídas').texto]]));
  const epCard = el('div', {class: 'sub-card'}, el('h3', {}, 'eProc'), linhas([
    mesAtualConcl && [`Conclusões em ${mesLongo(mesAtualConcl.mes)}`, fmt(mesAtualConcl.eproc)],
    e('eproc', 'Distribuídos') && ['Distribuídos (eProc' + (M.eproc_inicio ? ', desde ' + mesRot(M.eproc_inicio) : '') + ')', e('eproc', 'Distribuídos').texto], e('eproc', 'Baixas') && ['Baixas (eProc' + (M.eproc_inicio ? ', desde ' + mesRot(M.eproc_inicio) : '') + ')', e('eproc', 'Baixas').texto],
    e('eproc', 'Julgamentos') && ['Julgamentos (eProc' + (M.eproc_inicio ? ', desde ' + mesRot(M.eproc_inicio) : '') + ')', e('eproc', 'Julgamentos').texto], V.acervo_eproc && ['Acervo eProc', fmt(V.acervo_eproc.numero)]]));
  const resumo = el('section', {class: 'card', 'aria-labelledby': 'res-t'}, el('h2', {id: 'res-t'}, 'Resumo operacional'), el('div', {class: 'grid g-2 mt'}, pjeCard, epCard),
    el('p', {class: 'meta'}, 'Acumulados do eProc desde o início do uso pela comarca' + (M.eproc_inicio ? ` (${mesRot(M.eproc_inicio)})` : '') + '.'));
  // ---- índices ----
  const ind = el('section', {class: 'card', 'aria-labelledby': 'ind-t'}, el('h2', {id: 'ind-t'}, 'Índices'), el('div', {class: 'mini mt'},
    V.indice_baixas && el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Índice de baixas'), el('span', {class: 'v'}, V.indice_baixas.texto), el('span', {class: 's'}, 'baixas ÷ distribuídos · último valor disponível')),
    V.indice_julgamentos && el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, 'Índice de julgamentos'), el('span', {class: 'v'}, V.indice_julgamentos.texto), el('span', {class: 's'}, 'julgamentos ÷ distribuídos · último valor disponível'))),
    el('p', {class: 'meta'}, 'PJe + SEEU + SISCOM, período do painel estratégico. Sem avaliação de bom ou ruim: não há meta oficial nos dados.'));
  // ---- migração (sem percentual de conclusão: categorias não exclusivas) ----
  const aptosUn = (V.migracao_series.aptos_por_unidade || []).slice(0, 4);
  const migCard = el('section', {class: 'card', 'aria-labelledby': 'mig-t'}, el('header', {}, el('h2', {id: 'mig-t'}, 'Migração PJe → eProc'), el('a', {class: 'btn', href: link('migracao')}, 'Abrir módulo')),
    el('div', {class: 'mini'}, ...[['Total', V.migracao_total], ['Migrados', V.migrados], ['Aptos', V.aptos], ['Inaptos', V.inaptos]].filter(x => x[1]).map(([r, v]) => el('div', {class: 'kpi nolink'}, el('span', {class: 'ic'}, r), el('span', {class: 'v'}, v.texto)))),
    aptosUn.length ? barras({rotulo: 'Aptos por unidade', pontos: aptosUn.map(p => ({r: p.r, v: p.v}))}) : null,
    el('p', {class: 'meta'}, 'Migrados, aptos e inaptos não são categorias exclusivas; por isso não se calcula percentual de conclusão.'));
  raiz.append(el('div', {class: 'grid g-3 mt'}, resumo, el('div', {}, ind, el('div', {class: 'mt'}, migCard))));
  if (D.metas) {
    const cm = el('section', {class: 'card mt', 'aria-labelledby': 'metas-t'}, el('header', {}, el('h2', {id: 'metas-t'}, 'Metas Nacionais do CNJ — 1º grau'), el('a', {class: 'btn', href: link('metas')}, 'Abrir módulo')),
      el('p', {class: 'meta'}, `Cumprimento de cada meta na comarca de ${D.comarca} (painel de Metas, posição de ${D.metas.carimbo || '—'}; atualização mensal).`));
    cm.append(el('div', {class: 'grid g-kpi'}, ...D.metas.metas.map(m => el('a', {class: 'kpi', href: link('metas')}, el('span', {class: 'ic'}, m.nome),
      (m.subs && m.subs.length) ? el('div', {class: 'rows'}, ...m.subs.map(sb => el('div', {}, el('span', {}, sb.rotulo.split(' (')[0]), el('b', {}, sb.cumprimento || '—')))) : el('span', {class: 'v'}, m.cumprimento || '—'),
      seloMeta(m.status), el('span', {class: 's'}, m.titulo)))));
    raiz.append(cm);
  }
  raiz.append(el('div', {class: 'mt'}, desempenho()));

  // ---- ações rápidas ----
  const acao = (icone, texto, href) => el('a', {class: 'kpi', href}, el('span', {class: 'ic'}, ico(icone, 20), texto));
  raiz.append(el('section', {class: 'card mt', 'aria-labelledby': 'acoes-t'}, el('h2', {id: 'acoes-t'}, 'Ações rápidas'), el('div', {class: 'grid g-kpi mt'},
    acao('alerta', 'Ver processos críticos', link('processos', {fonte: 'Paral. >120 dias'})), acao('lista', 'Ver tarefas', link('tarefas')), acao('doc', 'Ver documentos não lidos', link('documentos')),
    acao('nuvem', 'Ver migração', link('migracao')), acao('check', 'Ver conclusões', link('conclusoes')), acao('caixa', 'Ver acervo', link('acervo')))));

  // ---- processos mais antigos (prévia) + contagem de tarefas antigas, quando a lista carregar ----
  const prev = el('section', {class: 'card mt', 'aria-labelledby': 'prev-t'}, el('header', {}, el('h2', {id: 'prev-t'}, 'Tarefas pendentes há mais tempo'), el('a', {class: 'btn pri', href: link('processos')}, 'Abrir lista completa')), el('p', {class: 'meta'}, 'Carregando…'));
  raiz.append(prev);
  PROC.then(P => {
    prev.querySelector('p.meta').remove();
    if (P.pendentes) {
      const c = P.pendentes.colunas, i = (n) => c.indexOf(n), top = P.pendentes.linhas.slice(0, 5);
      const maiores100 = P.pendentes.linhas.filter(l => l[i('Dias')] != null && l[i('Dias')] > 100).length;
      const travas = P.pendentes.linhas.filter(l => /travas? para migra/i.test(l[i('Tarefa')]));
      if (travas.length) { const a = el('div', {class: 'alerta warn'}, el('span', {class: 'selo'}, 'Atenção'), el('span', {class: 'n'}, fmt(travas.length)), el('span', {class: 't'}, 'processos com tarefa "Travas para Migração"'),
        el('span', {class: 'meta', style: 'margin:0'}, 'Tarefa do PJe (painel diário)'), el('a', {class: 'btn', href: link('processos', {fonte: 'pend', tarefa: travas[0][i('Tarefa')]})}, 'Ver processos')); caixa.insertBefore(a, slotTarefas); }
      slotTarefas.hidden = false; slotTarefas.replaceChildren(el('span', {class: 'selo'}, 'Informação'), el('span', {class: 'n'}, fmt(maiores100)), el('span', {class: 't'}, 'tarefas pendentes há mais de 100 dias'),
        el('span', {class: 'meta', style: 'margin:0'}, 'Inclui tarefas de espera (aguardar julgamento etc.)'), el('a', {class: 'btn', href: link('processos', {fonte: 'pend', dias: 101})}, 'Ver processos'));
      const t = el('table', {}, el('caption', {class: 'vh'}, 'Cinco tarefas pendentes mais antigas'), el('thead', {}, el('tr', {}, ...['Processo', 'Tarefa', 'Papel', 'Dias', 'Classe'].map(h => el('th', {scope: 'col'}, h)))));
      t.append(el('tbody', {}, ...top.map(l => el('tr', {}, el('td', {}, copiavel(l[i('Processo')])), el('td', {}, l[i('Tarefa')]), el('td', {}, l[i('Papel')]), el('td', {}, badgeDias(l[i('Dias')])), el('td', {}, l[i('Classe')])))));
      prev.append(el('div', {class: 'rolagem'}, t), el('p', {class: 'meta'}, `${fmt(P.pendentes.linhas.length)} processos com tarefa pendente (coletado ${ha(P.pendentes.coletado_em)}).`));
    }
  }).catch(err => { prev.querySelector('p.meta').textContent = 'Relação de processos indisponível (' + err.message + ').'; slotTarefas.remove(); });
  raiz.append(linhaFonte(['tarefas_pje_diario', 'docs_nao_lidos', 'migrador_pje', 'dados_estrategicos', 'mov_eproc']));
}
