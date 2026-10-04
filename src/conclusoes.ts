// Conclusões PJe + eProc: histórico completo por dia e por mês em uma consulta por sistema (porte de app/conclusoes.py).
// Referência = eventos (decisão do usuário); processos distintos também guardados.
import * as db from './db.js';
import { executarComComarca, novaColeta } from './coleta.js';
import type { Navegador } from './qlik.js';
import type { Celula, Coleta, DiaConclusoes, ItemJob, MesConclusoes, Paineis, ResultadoCubo, ResultadoJob, ResultadoValor, Selecao, Status } from './tipos.js';
import { ehErro } from './tipos.js';

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Sistema = 'pje' | 'eproc';

// sistema -> painel, campo de comarca, filtros fixos, campo do mês (rótulo), campo do dia, medidas [eventos, processos distintos]
const SISTEMAS: Record<Sistema, { painel: string; campo: string; fixos: Selecao[]; mes: string; dia: string; medidas: string[] }> = {
  pje: { painel: 'conclusoes_pje', campo: 'Comarca', fixos: [], mes: 'Período', dia: 'Data',
    medidas: ['Count(NUMERO_PROCESSO)', 'Count(DISTINCT NUMERO_PROCESSO)'] },
  eproc: { painel: 'mov_eproc', campo: 'Comarca_EPROC', fixos: [['Métrica_EPROC', 'Conclusão']], mes: 'Mês/Ano Métrica_EPROC', dia: 'Data Métrica_EPROC',
    medidas: ['Count(Métrica_EPROC)', 'Count(DISTINCT Processo_EPROC)'] },
};

const inteiro = (c: Celula | undefined) => (c && c.num != null ? Math.trunc(c.num) : 0);

export function dataIso(txt: string | null): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(txt).trim());
  if (!m) throw new Error(`data não reconhecida: ${txt}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// 'out/2026' (PJe) ou '2026/out' (eProc) -> '2026-10'
export function mesIso(rotulo: string | null): string {
  const partes = String(rotulo).trim().toLowerCase().split(/[/ ]/);
  const ano = partes.find((p) => /^\d{4}$/.test(p));
  const mes = partes.map((p) => p.slice(0, 3)).find((p) => MESES.includes(p));
  if (!ano || !mes) throw new Error(`mês não reconhecido: ${rotulo}`);
  return `${ano}-${String(MESES.indexOf(mes) + 1).padStart(2, '0')}`;
}

type Resumo = [status: Status, detalhe: string];

async function historico(nav: Navegador, paineis: Paineis, comarca: string, sistema: Sistema): Promise<Resumo> {
  const s = SISTEMAS[sistema], painel = paineis[s.painel];
  const rec = novaColeta(`conclusoes_${sistema}`);
  const fim = async (status: Status, extra: Partial<Coleta>): Promise<Resumo> => { Object.assign(rec, extra, { status, finalizada: db.agora() }); rec.id = await db.gravarColeta(rec); return [status, extra.erro || extra.detalhe || '']; };
  const itens: ItemJob[] = [
    { nome: 'dias', tipo: 'cubo', dimensoes: [s.dia], medidas: s.medidas },
    { nome: 'meses', tipo: 'cubo', dimensoes: [s.mes], medidas: s.medidas },
  ];
  if (sistema === 'pje') itens.push({ nome: 'ref', tipo: 'valor', medida: 'Data de referência:' });
  let res: ResultadoJob, tentativas: number;
  try {
    ({ res, tentativas } = await executarComComarca(nav, painel, comarca, (v) => ({ selecoes: [[s.campo, v], ...s.fixos], itens }), { campo: s.campo }));
  } catch (e) {
    return fim('FALHA', { erro: String((e as Error).message || e) });
  }
  if ('erro' in res) return fim('FALHA', { tentativas, erro: res.erro });
  const ruins = res.selecoes.filter((x) => !x.ok);
  if (ruins.length) return fim('FALHA', { tentativas, selecoes: res.selecoes, erro: 'filtro nao aplicado: ' + ruins.map((x) => `${x.campo}=${x.valor}`).join(', ') });
  const it = res.itens;
  const erro = (ehErro(it.dias) && it.dias.erro) || (ehErro(it.meses) && it.meses.erro);
  if (erro) return fim('FALHA', { tentativas, selecoes: res.selecoes, erro });
  const dias: DiaConclusoes[] = [], meses: MesConclusoes[] = [], somaDia: Record<string, number> = {}, avisos: string[] = [];
  for (const ln of (it.dias as ResultadoCubo).linhas) {
    const d = dataIso(ln[0].txt);
    dias.push({ data: d, eventos: inteiro(ln[1]), processos: inteiro(ln[2]) });
    somaDia[d.slice(0, 7)] = (somaDia[d.slice(0, 7)] || 0) + inteiro(ln[1]);
  }
  for (const ln of (it.meses as ResultadoCubo).linhas) {
    const m = mesIso(ln[0].txt), ev = inteiro(ln[1]);
    meses.push({ mes: m, eventos: ev, processos: inteiro(ln[2]) });
    if ((somaDia[m] || 0) !== ev) avisos.push(`${m}: soma dos dias (${somaDia[m] || 0}) != total do mês (${ev})`);
  }
  rec.extra = { dias, meses };
  const carimbo = ((it.ref || {}) as Partial<ResultadoValor>).txt || null;
  return fim(avisos.length ? 'PARCIAL' : 'OK', { tentativas, carimbo, selecoes: res.selecoes, erro: avisos.slice(0, 5).join('; ') || null,
    detalhe: `${dias.length} dias, ${meses.length} meses; ref=${carimbo}` });
}

// Devolve [[rótulo, status, detalhe]]
export async function coletar(nav: Navegador, paineis: Paineis, comarca: string): Promise<[string, Status, string][]> {
  const resumo: [string, Status, string][] = [];
  for (const sistema of ['pje', 'eproc'] as const) resumo.push([`conclusões ${sistema}`, ...(await historico(nav, paineis, comarca, sistema))]);
  return resumo;
}
