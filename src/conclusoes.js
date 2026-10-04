// Conclusões PJe + eProc: histórico completo por dia e por mês em uma consulta por sistema (porte de app/conclusoes.py).
// Referência = eventos (decisão do usuário); processos distintos também guardados.
import * as db from './db.js';
import { executarComComarca, novaColeta } from './coleta.js';

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// sistema -> painel, campo de comarca, filtros fixos, campo do mês (rótulo), campo do dia, medidas [eventos, processos distintos]
const SISTEMAS = {
  pje: { painel: 'conclusoes_pje', campo: 'Comarca', fixos: [], mes: 'Período', dia: 'Data',
    medidas: ['Count(NUMERO_PROCESSO)', 'Count(DISTINCT NUMERO_PROCESSO)'] },
  eproc: { painel: 'mov_eproc', campo: 'Comarca_EPROC', fixos: [['Métrica_EPROC', 'Conclusão']], mes: 'Mês/Ano Métrica_EPROC', dia: 'Data Métrica_EPROC',
    medidas: ['Count(Métrica_EPROC)', 'Count(DISTINCT Processo_EPROC)'] },
};

const inteiro = (c) => (c && c.num != null ? Math.trunc(c.num) : 0);

export function dataIso(txt) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(txt).trim());
  if (!m) throw new Error(`data não reconhecida: ${txt}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// 'out/2026' (PJe) ou '2026/out' (eProc) -> '2026-10'
export function mesIso(rotulo) {
  const partes = String(rotulo).trim().toLowerCase().split(/[/ ]/);
  const ano = partes.find((p) => /^\d{4}$/.test(p));
  const mes = partes.map((p) => p.slice(0, 3)).find((p) => MESES.includes(p));
  if (!ano || !mes) throw new Error(`mês não reconhecido: ${rotulo}`);
  return `${ano}-${String(MESES.indexOf(mes) + 1).padStart(2, '0')}`;
}

async function historico(nav, paineis, comarca, sistema) {
  const s = SISTEMAS[sistema], painel = paineis[s.painel];
  const rec = novaColeta(`conclusoes_${sistema}`);
  const fim = async (status, extra) => { Object.assign(rec, extra, { status, finalizada: db.agora() }); rec.id = await db.gravarColeta(rec); return [status, extra.erro || extra.detalhe || '']; };
  const itens = [
    { nome: 'dias', tipo: 'cubo', dimensoes: [s.dia], medidas: s.medidas },
    { nome: 'meses', tipo: 'cubo', dimensoes: [s.mes], medidas: s.medidas },
  ];
  if (sistema === 'pje') itens.push({ nome: 'ref', tipo: 'valor', medida: 'Data de referência:' });
  let res, tentativas;
  try {
    ({ res, tentativas } = await executarComComarca(nav, painel, comarca, (v) => ({ selecoes: [[s.campo, v], ...s.fixos], itens }), { campo: s.campo }));
  } catch (e) {
    return fim('FALHA', { erro: String(e.message || e) });
  }
  if (res.erro) return fim('FALHA', { tentativas, erro: res.erro });
  const ruins = res.selecoes.filter((x) => !x.ok);
  if (ruins.length) return fim('FALHA', { tentativas, selecoes: res.selecoes, erro: 'filtro nao aplicado: ' + ruins.map((x) => `${x.campo}=${x.valor}`).join(', ') });
  const it = res.itens;
  const erro = it.dias.erro || it.meses.erro;
  if (erro) return fim('FALHA', { tentativas, selecoes: res.selecoes, erro });
  const dias = [], meses = [], somaDia = {}, avisos = [];
  for (const ln of it.dias.linhas) {
    const d = dataIso(ln[0].txt);
    dias.push({ data: d, eventos: inteiro(ln[1]), processos: inteiro(ln[2]) });
    somaDia[d.slice(0, 7)] = (somaDia[d.slice(0, 7)] || 0) + inteiro(ln[1]);
  }
  for (const ln of it.meses.linhas) {
    const m = mesIso(ln[0].txt), ev = inteiro(ln[1]);
    meses.push({ mes: m, eventos: ev, processos: inteiro(ln[2]) });
    if ((somaDia[m] || 0) !== ev) avisos.push(`${m}: soma dos dias (${somaDia[m] || 0}) != total do mês (${ev})`);
  }
  rec.extra = { dias, meses };
  const carimbo = (it.ref || {}).txt || null;
  return fim(avisos.length ? 'PARCIAL' : 'OK', { tentativas, carimbo, selecoes: res.selecoes, erro: avisos.slice(0, 5).join('; ') || null,
    detalhe: `${dias.length} dias, ${meses.length} meses; ref=${carimbo}` });
}

// Devolve [[rótulo, status, detalhe]]
export async function coletar(nav, paineis, comarca) {
  const resumo = [];
  for (const sistema of ['pje', 'eproc']) resumo.push([`conclusões ${sistema}`, ...(await historico(nav, paineis, comarca, sistema))]);
  return resumo;
}
