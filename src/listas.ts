// Relações de processos (porte de app/processos.py e app/apoio_relatorio.py). Ficam só no IndexedDB deste navegador.
// Entrada = tabela do engine {colunas, linhas (texto)}. Colunas com nome de pessoa (assinou/incluiu/alterou/juntou) não são mapeadas de propósito.
import * as db from './db.js';
import { executarComComarca } from './coleta.js';
import type { Navegador } from './qlik.js';
import type { AbaApoio, Linha, Painel, ResultadoJob, ResultadoTabela, Selecao, Status } from './tipos.js';
import { ehErro } from './tipos.js';

type Tabela = Pick<ResultadoTabela, 'colunas' | 'linhas'>;
type Valor = string | number | null | undefined;

const inteiro = (v: Valor) => { const s = String(v ?? '').replace(/[^\d-]/g, ''); return s === '' || s === '-' ? null : parseInt(s, 10); };
const texto = (v: Valor) => (v == null ? '' : String(v).trim());
const digitos = (s: Valor) => String(s ?? '').replace(/\D/g, '');
const porDias = (linhas: Linha[], k: number) => linhas.sort((a, b) => ((b[k] as number | null) ?? -1) - ((a[k] as number | null) ?? -1));

const COLUNAS_PENDENTES: [string, string][] = [
  ['Processo', 'Processo'], ['Tarefa', 'Tarefa'], ['Papel', 'Papel'], ['Data Tarefa', 'Data da tarefa'],
  ['__dias', 'Dias'], ['Classe', 'Classe'], ['Assunto Principal', 'Assunto'], ['Órgão Julgador', 'Órgão julgador'],
  ['Prioridade Legal', 'Prioridade'], ['Segredo Justiça', 'Segredo'], ['Última Movimentação', 'Última movimentação'],
  ['Data Última Movimentação', 'Data da última mov.'],
];
const COLUNAS_APOIO = ['Número Feito', 'Unidade Judiciária', 'Sistema', 'Classe', 'Competência', 'Assunto Principal', 'Última Movimentação',
  'Data Última Movimentação', 'Data da Distribuição', 'Prioridade Legal'];

// lista simples: mapa = [[coluna na origem, rótulo]]; 'Dias' vira número e ordena (maior primeiro)
function mapear(t: Tabela, mapa: [string, string][]): { colunas: string[]; linhas: Linha[] } {
  const idx = mapa.filter(([o]) => t.colunas.includes(o)).map(([o, r]): [number, string] => [t.colunas.indexOf(o), r]);
  const cols = idx.map(([, r]) => r);
  const linhas = t.linhas.filter((l) => l.some((x) => x)).map((l) => idx.map(([i, r]) => (r === 'Dias' ? inteiro(l[i]) : texto(l[i]))));
  if (cols.includes('Dias')) porDias(linhas, cols.indexOf('Dias'));
  return { colunas: cols, linhas };
}

function pendentes(t: Tabela) {
  const ix: Record<string, number> = Object.fromEntries(t.colunas.map((c, i) => [c, i]));
  const colDias = t.colunas.find((c) => c.startsWith('Tempo Decorrido') && !c.includes('Conclus'));
  const linhas: Linha[] = t.linhas.filter((r) => r[ix.Processo]).map((r) => COLUNAS_PENDENTES.map(([o]) => (o === '__dias' ? (colDias ? inteiro(r[ix[colDias]]) : null) : texto(r[ix[o]]))));
  porDias(linhas, COLUNAS_PENDENTES.findIndex(([o]) => o === '__dias'));
  return { colunas: COLUNAS_PENDENTES.map(([, r]) => r), linhas };
}

const cnj = (v: Valor) => { const d = digitos(v); return d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d[13]}.${d.slice(14, 16)}.${d.slice(16, 20)}` : String(v ?? ''); };

function metas(t: Tabela) {
  const r = mapear(t, [['NÚMERO PROCESSO', 'Processo'], ['META', 'Meta'], ['VARA', 'Vara'], ['CONCLUSO PARA JULGAMENTO', 'Concluso p/ julgamento'],
    ['ANO DISTRIBUIÇÃO', 'Ano de distribuição'], ['LOCALIZAÇÃO', 'Localização'], ['NATUREZA', 'Natureza'], ['TIPO DE JUSTIÇA', 'Tipo de justiça']]);
  const ip = r.colunas.indexOf('Processo'), iv = r.colunas.indexOf('Vara');
  for (const l of r.linhas) { if (ip >= 0) l[ip] = cnj(l[ip]); if (iv >= 0) l[iv] = String(l[iv]).replace(/ da comarca de .*$/i, ''); }
  return r;
}

const docs = (t: Tabela) => mapear(t, [['Processo', 'Processo'], ['Documento', 'Documento'], ['Data Documento', 'Data do documento'], ['Descrição', 'Descrição'],
  ['Perfil', 'Perfil'], ['Classe', 'Classe'], ['Assunto Principal', 'Assunto'], ['Órgão Julgador', 'Órgão julgador'], ['Sigiloso', 'Doc. sigiloso'], ['Segredo Justiça', 'Segredo']]);

const semanal = (t: Tabela) => mapear(t, [['Feito', 'Processo'], ['Tarefas/Agrupador', 'Tarefa'], ['Tipos de Pesquisa', 'Tipo'], ['Data', 'Data da posição'],
  ['Tempo em dias', 'Dias'], ['Órgão Julgador', 'Órgão julgador']]);

// painel -> [nome da lista no hub, conversor]
const CONVERSORES: Record<string, [string, (t: Tabela) => { colunas: string[]; linhas: Linha[] }]> = {
  tarefas_pje_diario: ['pendentes', pendentes], tarefas_pje_semanal: ['semanal', semanal], docs_nao_lidos: ['docs', docs], metas_cnj: ['metas', metas],
};

// grava a relação de processos de um painel (tabela do engine). Devolve o nº de linhas ou null se o painel não tem lista.
export async function gravarDoPainel(painelId: string, tabela: Tabela | null | undefined): Promise<number | null> {
  const c = CONVERSORES[painelId];
  if (!c || !tabela) return null;
  const lista = { nome: c[0], coletado_em: db.agora(), ...c[1](tabela) };
  await db.gravarLista(lista);
  return lista.linhas.length;
}

// ---------- Apoio ao planejamento: listas por métrica SEM o que já consta no painel diário ----------
const METRICAS: [string, string, string | null][] = [
  ['Concl. Despacho', 'Conclusos para Despacho', null],
  ['Concl. Decisão', 'Conclusos para Decisão', null],
  ['Concl. Sentença', 'Conclusos para Sentença', null],
  ['SML Secretaria', 'Paralisados SML em Secretaria', '> 30 dias'],
  ['SML Gabinete', 'Paralisados SML em Gabinete', '> 30 dias'],
  ['CML (motivo legal)', 'Paralisados CML', null],
];
// listas COMPLETAS (sem remover duplicados) que alimentam os alertas da Visão Geral
const CRITICAS: [string, string, string | null][] = [
  ['Paral. >120 dias', 'Paralisados SML em Secretaria', '> 120 dias'],
  ['Paral. >100 dias', 'Paralisados SML em Secretaria', '> 100 dias'],
];
const EST = 'est_conclusos';   // estado alternativo do Qlik usado pela lista de processos do painel

// Uma execução por métrica (a lista só aparece com 1 métrica selecionada no estado est_conclusos). Devolve {status, avisos, resumo}.
export async function gerarApoio(nav: Navegador, painel: Painel, comarca: string) {
  const atuais = await db.listas();
  const vistos = new Set((atuais.pendentes ? atuais.pendentes.linhas : []).map((l) => digitos(l[0])));
  const avisos: string[] = [];
  if (!atuais.pendentes) avisos.push('sem a relação do painel diário: nenhuma duplicidade removida');
  else if ((Date.now() - new Date(atuais.pendentes.coletado_em).getTime()) / 36e5 > 36) avisos.push('relação do painel diário com mais de 36 h');
  const abas: AbaApoio[] = [], resumo: (string | number)[][] = [];
  let ref: Record<string, string> | null = null;
  const criticas = new Set(CRITICAS.map((c) => c[0]));
  for (const [aba, metrica, faixa] of [...CRITICAS, ...METRICAS]) {
    let res: ResultadoJob;
    try {
      ({ res } = await executarComComarca(nav, painel, comarca, (v) => {
        const sel: Selecao[] = [[painel.campoComarca, v], [painel.campoComarca, v, EST], ['DESCRICAO_METRICA', [metrica], EST]];
        if (faixa) sel.push(['DESCRICAO_DIM_DIAS', [faixa], EST]);
        return { selecoes: sel, dinamicos: [{ campo: 'ANO_12_MESES', tipo: 'ultimo' }, { campo: 'MES_12_MESES', tipo: 'ultimo' }],
          itens: [{ nome: 'lista', tipo: 'tabela', objeto: 'table', titulo_contem: 'Lista de processos' }] };
      }));
    } catch (e) { res = { erro: String((e as Error).message || e) }; }
    const lista = 'itens' in res ? res.itens.lista : undefined;
    const erro = ('erro' in res && res.erro) || (ehErro(lista) && lista.erro);
    const ruins = ('selecoes' in res ? res.selecoes : []).filter((s) => !s.ok);
    if (erro || ruins.length || !('itens' in res)) {
      const msg = erro || 'filtro nao aplicado: ' + ruins.map((s) => `${s.campo}=${s.valor}`).join(', ');
      avisos.push(`${aba}: ${msg}`); resumo.push([aba, 'erro', msg]);
      continue;
    }
    ref = ref || Object.fromEntries(res.selecoes.filter((s) => s.dinamico).map((s) => [s.campo, s.valor as string]));
    const t = lista as ResultadoTabela;
    const iNum = t.colunas.indexOf('Número Feito');
    const completa = criticas.has(aba);   // lista de alerta: mantém todos, mesmo os que estão no painel diário
    const novas = t.linhas.filter((ln) => completa || !vistos.has(digitos(ln[iNum])));
    const cols = COLUNAS_APOIO.filter((c) => t.colunas.includes(c)), idx = cols.map((c) => t.colunas.indexOf(c));
    abas.push({ aba, metrica, colunas: cols, completa, linhas: novas.filter((r) => r.some((x) => x)).map((r) => idx.map((i) => texto(r[i]))) });
    resumo.push([aba, t.total, t.total - novas.length, novas.length]);
  }
  const mes = ref && ref.MES_12_MESES ? `${String(parseInt(ref.MES_12_MESES, 10)).padStart(2, '0')}/${ref.ANO_12_MESES}` : '';
  if (abas.length) await db.gravarLista({ nome: 'apoio', coletado_em: db.agora(), mes_referencia: mes, abas });
  const status: Status = !abas.length ? 'FALHA' : avisos.length ? 'PARCIAL' : 'OK';
  return { status, avisos, resumo, mes };
}
