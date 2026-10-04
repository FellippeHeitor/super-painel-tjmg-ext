// Tipos compartilhados: configuração dos painéis (config/paineis.json, config/site.json), jobs/resultados do engine e registros do IndexedDB.
// Só descrevem o que o código já usa; nenhum campo do Qlik é inventado aqui.

// ---------- config/paineis.json ----------
// Como achar um objeto numa sheet do Qlik (engine.ts: acha/idxMedida)
export interface Localizador {
  objeto?: string;
  titulo_contem?: string;
  dimensao?: string;
  dimensao_contem?: string;
  medida?: string;
  medida_contem?: string;
  n?: number;
  sheet?: string;
  variaveis?: Record<string, number | string>;
  max_linhas?: number;
}

export type Frequencia = 'diaria' | 'semanal' | 'mensal' | 'mensal_dia15';

// [campo, valor (texto = Select; lista = SelectValues exato), estado alternativo?]
export type Selecao = [campo: string, valor: string | string[], estado?: string];

export interface Painel {
  id: string;
  nome: string;
  appid: string;
  sheet: string;
  campoComarca: string;
  frequencia?: Frequencia;
  carimbo?: Localizador & { expressao?: string };
  kpis?: Record<string, Localizador>;
  series?: Record<string, Localizador & { opcional?: boolean }>;
  cubos_valor?: Record<string, { medidas: string[] }>;
  cubos_serie?: Record<string, { dimensoes: string[]; medidas: string[] }>;
  textos?: Record<string, { sheet?: string; objeto?: string; contem?: string }>;
  exprs?: Record<string, { sheet?: string; variaveis?: Record<string, number | string> }>;
  exporta_tabela?: string;
  exporta_tabela_spec?: Localizador;
  lista_por_campo?: string;
  filtros_dinamicos?: { campo: string }[];
  variantes?: { id: string; selecoes: Selecao[] }[];
  sheets_metas?: Record<string, string>;
}

export type Paineis = Record<string, Painel>;

// ---------- config/site.json ----------
export interface SecaoSite {
  painel: string;
  titulo: string;
  kpis?: Record<string, string>;
  series?: Record<string, { rotulo: string; top?: number; ordem?: 'valor' | 'original' }>;
  referencia?: { ano: string; mes: string };
  tabela?: { rotulo: string; colunas: Record<string, string> };
}

// ---------- jobs do engine ----------
export type TipoItem = 'valor' | 'serie' | 'cubo' | 'tabela' | 'prop' | 'exprs' | 'campo';

export interface ItemJob extends Localizador {
  nome: string;
  tipo: TipoItem;
  dimensoes?: string[];   // cubo
  medidas?: string[];     // cubo
  campo?: string;         // campo
  estado?: string;        // campo
  contem?: string;        // prop
  prop?: string;          // prop
  opcional?: boolean;
}

export interface Dinamico { campo: string; tipo: 'ultimo'; estado?: string }

export interface Job {
  sheet?: string;
  selecoes?: Selecao[];
  dinamicos?: Dinamico[];
  itens: ItemJob[];
  timeout_ms?: number;
}

export interface Celula { txt: string | null; num: number | null }

export interface ResultadoValor { txt: string | null; num: number | null }
export interface ResultadoSerie { dimensoes: string[]; medida: string; total: number; linhas: { r: string[]; v: Celula }[] }
export interface ResultadoCubo { total: number; linhas: Celula[][] }
export interface ResultadoTabela { colunas: string[]; total: number; linhas: string[][] }
export interface ResultadoProp { txt: string }
export interface ResultadoExprs { itens: { expr: string; txt: string; num: number | null; titulo: string }[] }
export interface ResultadoCampo { total: number; valores: { txt: string; estado: string }[] }
export interface ErroItem { erro: string; candidatos?: number }

export type ResultadoItem = ResultadoValor | ResultadoSerie | ResultadoCubo | ResultadoTabela | ResultadoProp | ResultadoExprs | ResultadoCampo | ErroItem;

export interface SelecaoAplicada { campo: string; valor: string | string[] | null; ok: boolean; dinamico?: boolean }

export interface ResultadoOk { selecoes: SelecaoAplicada[]; itens: Record<string, ResultadoItem> }
export interface ErroJob { erro: string }
export type ResultadoJob = ResultadoOk | ErroJob;

export const ehErro = (r: object | null | undefined): r is ErroItem => !!r && 'erro' in r && !!(r as ErroItem).erro;

// ---------- IndexedDB ----------
export type Status = 'EM_ANDAMENTO' | 'OK' | 'PARCIAL' | 'FALHA';

export interface Par { texto: string | null; numero: number | null }
export interface PontoSerie { rotulo: string; texto: string | null; numero: number | null }

export interface DiaConclusoes { data: string; eventos: number; processos: number }
export interface MesConclusoes { mes: string; eventos: number; processos: number }

export interface Coleta {
  id?: number;
  painel: string;
  iniciada: string;
  finalizada?: string;
  status: Status;
  tentativas: number;
  carimbo: string | null;
  selecoes: SelecaoAplicada[] | null;
  erro: string | null;
  valores: Record<string, Par>;
  series: Record<string, PontoSerie[]>;
  extra?: { dias: DiaConclusoes[]; meses: MesConclusoes[] };
  detalhe?: string;
}

// coleta já gravada (tem id)
export type ColetaGravada = Coleta & { id: number };

export type Linha = (string | number | null)[];

export interface ListaSimples { nome: string; coletado_em: string; colunas: string[]; linhas: Linha[] }
export interface AbaApoio { aba: string; metrica: string; colunas: string[]; completa: boolean; linhas: string[][] }
export interface ListaApoio { nome: 'apoio'; coletado_em: string; mes_referencia: string; abas: AbaApoio[] }
export type Lista = ListaSimples | ListaApoio;

export interface Listas { pendentes?: ListaSimples; semanal?: ListaSimples; docs?: ListaSimples; metas?: ListaSimples; apoio?: ListaApoio }

// ---------- preferências (chrome.storage.local) ----------
export interface Prefs { comarca: string | null; comarcas: string[]; automatico: boolean; horarios: string[] }

export type NivelLog = '' | 'ok' | 'aviso' | 'erro';
