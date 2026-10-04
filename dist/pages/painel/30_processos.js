// ===== Processos: lista, filtros, ordenação, paginação, CSV, gaveta de detalhes =====
const FAIXAS_DIAS = [60, 80, 100, 120];
function copiavel(numero){
  const b = el('button', {type: 'button', class: 'copiar', title: 'Clique para copiar o número', 'aria-label': `Copiar número do processo ${numero}`}, numero);
  b.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    try { await navigator.clipboard.writeText(numero); } catch (e) { const t = el('textarea', {style: 'position:fixed;opacity:0'}); t.value = numero; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (e2) { /* sem permissão de cópia */ } t.remove(); }
    b.textContent = 'Copiado ✓'; b.setAttribute('aria-live', 'polite');
    setTimeout(() => { b.textContent = numero; b.removeAttribute('aria-live'); }, 1200);
  });
  return b;
}
const gaveta = () => document.getElementById('gaveta');
function abrirGaveta(titulo, colunas, linha, origem){
  const g = gaveta();
  const dl = el('dl', {});
  colunas.forEach((c, k) => { const v = linha[k]; dl.append(el('dt', {}, c), el('dd', {}, c === 'Dias' ? badgeDias(v) : (/^(Processo|Número Feito)$/.test(c) ? copiavel(v) : (v == null || v === '' ? '—' : String(v))))); });
  const fechar = el('button', {class: 'btn', type: 'button', 'aria-label': 'Fechar detalhes'}, ico('fechar', 16), 'Fechar');
  fechar.addEventListener('click', () => g.close());
  g.replaceChildren(el('div', {style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px'}, el('h2', {id: 'gaveta-t'}, titulo), fechar), dl);
  g.showModal();
  g.addEventListener('close', () => { if (origem && origem.isConnected) origem.focus(); }, {once: true});
}
document.addEventListener('click', (ev) => { const g = gaveta(); if (g.open && ev.target === g) g.close(); });   // clique no fundo fecha

function viewProcessos(raiz){
  const corpo = el('div', {}, el('p', {class: 'meta'}, 'Carregando a relação de processos…'));
  raiz.append(corpo);
  const chaveData = (t) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t || ''); return m ? +(m[3] + m[2] + m[1]) : -1; };
  PROC.then(P => {
    corpo.replaceChildren();
    const fontes = [];
    const add = (id, nome, t, info, o) => { if (t) fontes.push(Object.assign({id, nome, rotulo: `${nome} · ${fmt(t.linhas.length)}`, colunas: t.colunas, linhas: t.linhas, info, dias: t.colunas.includes('Dias')}, o)); };
    if (P.apoio) for (const a of P.apoio.abas.filter(x => x.completa)) add(a.aba, a.aba.replace('Paral.', 'Paralisados'), a, `Lista completa do alerta da Visão Geral (paralisados sem motivo legal em Secretaria, ${a.aba.replace('Paral. ', '')}), posição do fim de ${P.apoio.mes_referencia}. Não remove os que também constam nos pendentes do painel diário.`, {filtros: ['Sistema', 'Unidade Judiciária'], principais: ['Número Feito', 'Unidade Judiciária', 'Sistema', 'Classe', 'Última Movimentação', 'Data Última Movimentação']});
    add('pend', 'Pendentes (diário)', P.pendentes, P.pendentes && `Tarefas pendentes do PJe (painel diário), coletadas em ${dtHora(P.pendentes.coletado_em)}. "Dias" = tempo decorrido desde a data de referência da tarefa. Processos criminais realmente sigilosos não constam nesse painel.`, {filtros: ['Tarefa', 'Papel', 'Prioridade', 'Segredo', 'Classe'], principais: ['Processo', 'Tarefa', 'Papel', 'Dias', 'Classe', 'Prioridade', 'Segredo']});
    add('semanal', 'Tarefas (semanal)', P.semanal, P.semanal && `Tarefas pendentes do PJe (painel semanal), posição de ${P.semanal.linhas[0] ? P.semanal.linhas[0][P.semanal.colunas.indexOf('Data da posição')] : '—'}, coletada em ${dtHora(P.semanal.coletado_em)}. "Dias" = tempo na tarefa.`, {filtros: ['Tarefa', 'Tipo'], principais: ['Processo', 'Tarefa', 'Tipo', 'Dias', 'Data da posição']});
    add('docs', 'Documentos não lidos', P.docs, P.docs && `Documentos juntados e ainda não lidos, coletados em ${dtHora(P.docs.coletado_em)}. Nomes de quem assinou ou juntou não são exibidos.`, {filtros: ['Documento', 'Classe', 'Segredo'], principais: ['Processo', 'Documento', 'Data do documento', 'Perfil', 'Classe', 'Segredo']});
    add('metas', 'Metas CNJ: pendentes', P.metas, P.metas && `Listagem de processos pendentes das Metas Nacionais do CNJ (painel de Metas, comarca de ${D.comarca}), coletada em ${dtHora(P.metas.coletado_em)}.`, {filtros: ['Meta', 'Vara', 'Concluso p/ julgamento', 'Localização', 'Natureza', 'Ano de distribuição'], principais: ['Processo', 'Meta', 'Vara', 'Concluso p/ julgamento', 'Ano de distribuição', 'Localização', 'Natureza']});
    if (P.apoio) for (const a of P.apoio.abas.filter(x => !x.completa)) add(a.aba, a.aba, a, `Apoio ao planejamento, mês de referência ${P.apoio.mes_referencia} (posição do fim do mês), já SEM o que consta nos pendentes do painel diário. Métrica: ${a.metrica}.`, {filtros: ['Sistema', 'Unidade Judiciária'], principais: ['Número Feito', 'Unidade Judiciária', 'Sistema', 'Classe', 'Última Movimentação', 'Data Última Movimentação']});
    if (!fontes.length) { corpo.append(el('p', {class: 'erro'}, 'Sem lista de processos coletada ainda.')); return; }
    fontes.forEach(f => { f.principais = (f.principais || f.colunas).filter(c => f.colunas.includes(c)); f.filtros = (f.filtros || []).filter(c => f.colunas.includes(c)); });

    let atual = fontes[0], q = '', fil = {}, diasMin = '', pag = 0, por = 50, ordCol = 0, ordDir = 1;
    const abas = el('div', {class: 'chips', role: 'group', 'aria-label': 'Listas de processos'});
    const info = el('p', {class: 'meta'}), faixas = el('div', {class: 'chips', role: 'group', 'aria-label': 'Atalhos de dias e prioridade'});
    const busca = el('input', {type: 'search', placeholder: 'Pesquisar processo, tarefa, classe ou assunto…', 'aria-label': 'Pesquisar nesta lista'});
    const btnCsv = el('button', {class: 'btn', type: 'button'}, ico('baixar', 16), 'Exportar CSV');
    const selPor = el('select', {'aria-label': 'Registros por página'}, ...[25, 50, 100, 200].map(n => el('option', {value: n}, `${n} por página`)));
    selPor.value = String(por);
    const avancados = el('details', {class: 'avancados'}, el('summary', {}, 'Filtros avançados'));
    const filtrosBox = el('div', {class: 'filtros'}); avancados.append(filtrosBox);
    const inDias = el('input', {type: 'number', min: '0', 'aria-label': 'Dias mínimos', placeholder: 'Dias ≥'});
    const tabelaDiv = el('div', {class: 'tproc'}), pagDiv = el('div', {class: 'pag'});
    corpo.append(abas, info, el('div', {class: 'barra-busca'}, busca, selPor, btnCsv), faixas, avancados, tabelaDiv, pagDiv);

    const idx = (n) => atual.colunas.indexOf(n);
    let selects = [];
    function passa(l, ignorar){
      const nq = norm(q);
      if (nq && !norm(l.join(' ')).includes(nq)) return false;
      for (const c of atual.filtros) if (c !== ignorar && fil[c] && l[idx(c)] !== fil[c]) return false;
      if (ignorar !== 'dias' && diasMin !== '') { const d = l[idx('Dias')]; if (d == null || d < +diasMin) return false; }
      return true;
    }
    function linhasFiltradas(){
      const c = ordCol, nome = atual.colunas[c], num = nome === 'Dias', data = /^Data/.test(nome);
      const chave = (l) => num ? (l[c] == null ? -1 : l[c]) : data ? chaveData(l[c]) : norm(l[c]);
      return atual.linhas.filter(l => passa(l)).sort((a, b) => { const x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : 0) * ordDir; });
    }
    function montarFiltros(){
      filtrosBox.replaceChildren(); selects = [];
      atual.filtros.forEach(col => { const s = el('select', {'aria-label': col}); s.addEventListener('change', () => { fil[col] = s.value; pag = 0; desenhar(); }); selects.push([col, s]); filtrosBox.append(s); });
      if (atual.dias) filtrosBox.append(el('label', {}, el('span', {class: 'vh'}, 'Dias mínimos'), inDias));
    }
    function atualizar(){
      for (const [col, sel] of selects) {
        const i = idx(col), cont = new Map();
        for (const l of atual.linhas) if (passa(l, col) && l[i]) cont.set(l[i], (cont.get(l[i]) || 0) + 1);
        const total = [...cont.values()].reduce((a, b) => a + b, 0);
        sel.replaceChildren(el('option', {value: ''}, `${col}: todos (${fmt(total)})`), ...[...cont.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => el('option', {value: v}, `${v} (${fmt(n)})`)));
        sel.value = fil[col] && cont.has(fil[col]) ? fil[col] : ''; if (!sel.value) fil[col] = '';
      }
      faixas.replaceChildren();
      const mk = (txt, on, fn) => { const b = el('button', {type: 'button', class: 'chip', 'aria-pressed': String(!!on)}, txt); b.addEventListener('click', fn); faixas.append(b); };
      if (atual.dias) {
        const n = (min) => atual.linhas.filter(l => passa(l, 'dias') && (min === '' || (l[idx('Dias')] != null && l[idx('Dias')] >= min))).length;
        mk(`Todos · ${fmt(n(''))}`, diasMin === '', () => { diasMin = ''; inDias.value = ''; pag = 0; desenhar(); });
        for (const f of FAIXAS_DIAS) mk(`> ${f} dias · ${fmt(n(f + 1))}`, diasMin === String(f + 1), () => { diasMin = String(f + 1); inDias.value = diasMin; pag = 0; desenhar(); });   // "acima de N" = estritamente maior
      }
      if (atual.filtros.includes('Prioridade')) mk('Prioritários', fil['Prioridade'] === 'Sim', () => { fil['Prioridade'] = fil['Prioridade'] === 'Sim' ? '' : 'Sim'; pag = 0; desenhar(); });
      mk('Limpar filtros', false, () => { q = ''; busca.value = ''; fil = {}; diasMin = ''; inDias.value = ''; pag = 0; desenhar(); });
    }
    function desenhar(){
      atualizar();
      const L = linhasFiltradas(), paginas = Math.max(1, Math.ceil(L.length / por));
      pag = Math.min(pag, paginas - 1);
      const cols = atual.principais, t = el('table', {}, el('caption', {class: 'vh'}, atual.rotulo));
      const tr = el('tr', {});
      cols.forEach(c => {
        const k = idx(c), ativo = k === ordCol, b = el('button', {type: 'button', title: `Ordenar por ${c}`}, c, el('span', {'aria-hidden': 'true'}, ativo ? (ordDir > 0 ? ' ▲' : ' ▼') : ''));
        b.addEventListener('click', () => { if (ordCol === k) ordDir = -ordDir; else { ordCol = k; ordDir = 1; } pag = 0; desenhar(); });
        tr.append(el('th', {scope: 'col', class: c === 'Dias' ? 'n' : '', 'aria-sort': ativo ? (ordDir > 0 ? 'ascending' : 'descending') : 'none'}, b));
      });
      tr.append(el('th', {scope: 'col'}, el('span', {class: 'vh'}, 'Detalhes')));
      t.append(el('thead', {}, tr));
      const tb = el('tbody', {});
      for (const l of L.slice(pag * por, pag * por + por)) {
        const det = el('button', {type: 'button', class: 'btn', 'aria-label': `Ver detalhes do processo ${l[0]}`}, ico('olho', 15));
        det.addEventListener('click', () => abrirGaveta('Detalhes do processo', atual.colunas, l, det));
        tb.append(el('tr', {}, ...cols.map(c => { const v = l[idx(c)];
          return el('td', {class: c === 'Dias' ? 'n' : ''}, c === 'Dias' ? badgeDias(v) : (/^(Processo|Número Feito)$/.test(c) ? copiavel(v) : (v == null ? '' : v))); }), el('td', {}, det)));
      }
      t.append(tb); tabelaDiv.replaceChildren(t);
      pagDiv.replaceChildren();
      const ant = el('button', {class: 'btn', type: 'button'}, '‹ Anterior'), prox = el('button', {class: 'btn', type: 'button'}, 'Próxima ›');
      ant.disabled = pag === 0; prox.disabled = pag >= paginas - 1;
      ant.addEventListener('click', () => { pag--; desenhar(); }); prox.addEventListener('click', () => { pag++; desenhar(); });
      pagDiv.append(ant, el('span', {role: 'status'}, `Página ${pag + 1} de ${paginas} · ${fmt(L.length)} de ${fmt(atual.linhas.length)} processos`), prox);
    }
    function escolher(f, opcoes = {}){
      atual = f; q = opcoes.q || ''; fil = {}; if (opcoes.tarefa && f.filtros.includes('Tarefa')) fil['Tarefa'] = opcoes.tarefa;
      for (const [c, v] of Object.entries(opcoes.fil || {})) if (f.filtros.includes(c)) fil[c] = v; diasMin = opcoes.dias != null && opcoes.dias !== '' ? String(opcoes.dias) : ''; pag = 0; busca.value = q; inDias.value = diasMin;
      ordCol = f.dias ? idx('Dias') : 0; ordDir = f.dias ? -1 : 1;
      info.textContent = f.info || '';
      abas.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === f.id)));
      montarFiltros(); desenhar();
    }
    for (const f of fontes) { const b = el('button', {type: 'button', class: 'chip', 'data-id': f.id}, f.rotulo); b.addEventListener('click', () => escolher(f)); abas.append(b); }
    busca.addEventListener('input', () => { q = busca.value; pag = 0; desenhar(); });
    selPor.addEventListener('change', () => { por = +selPor.value; pag = 0; desenhar(); });
    inDias.addEventListener('input', () => { diasMin = inDias.value; pag = 0; desenhar(); });
    btnCsv.addEventListener('click', () => {
      const aspas = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const txt = '﻿' + [atual.colunas.map(aspas).join(';'), ...linhasFiltradas().map(l => l.map(aspas).join(';'))].join('\r\n');
      const a = el('a', {href: URL.createObjectURL(new Blob([txt], {type: 'text/csv;charset=utf-8'})), download: 'processos_' + atual.id.replace(/[^\w]+/g, '_') + '.csv'});
      document.body.append(a); a.click(); a.remove();
    });
    // aplicado por deep link (#processos?fonte=…&dias=…&q=…) e pelos atalhos de outras visões
    window.__procAplicar = (params) => {
      const alvo = params.get('fonte'), f = fontes.find(x => x.id === alvo || x.nome === alvo || x.id === 'pend' && alvo === 'pendentes') || (alvo ? null : atual);
      escolher(f || fontes.find(x => x.id === 'pend') || fontes[0], {dias: params.get('dias'), q: params.get('q'), tarefa: params.get('tarefa'), fil: Object.fromEntries([...params.entries()].filter(([k]) => k.startsWith('f.')).map(([k, v]) => [k.slice(2), v]))});
    };
    window.__procAplicar(hashInfo().params);
    // contagens para os atalhos de outras visões
    const pend = fontes.find(x => x.id === 'pend'), sem = fontes.find(x => x.id === 'semanal');
    const contar = (f) => f ? Object.fromEntries([[0, f.linhas.length]].concat(FAIXAS_DIAS.map(d => [d, f.linhas.filter(l => l[f.colunas.indexOf('Dias')] != null && l[f.colunas.indexOf('Dias')] > d).length]))) : null;
    window.__procContagens = {pend: contar(pend), semanal: contar(sem)};
  }).catch(e => { corpo.replaceChildren(el('p', {class: 'erro', role: 'alert'}, 'Não foi possível carregar a relação de processos (' + e.message + '). Rode a coleta em "Atualizar dados".')); });
}
