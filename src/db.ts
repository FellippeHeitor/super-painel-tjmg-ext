// IndexedDB local (substitui o SQLite do robô). Tudo fica só neste navegador.
//  coletas: {id, painel, iniciada, finalizada, status, tentativas, carimbo, selecoes, erro, valores:{chave:{texto,numero}},
//            series:{chave:[{rotulo,texto,numero}]}, extra?}   (índice por painel)
//  listas:  {nome, coletado_em, ...}  relações de processos (só a mais recente de cada uma)
import type { Coleta, ColetaGravada, Lista, Listas } from './tipos.js';

type Loja = 'coletas' | 'listas';

const NOME = 'superpainel', VERSAO = 1;
let dbp: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        const c = db.createObjectStore('coletas', { keyPath: 'id', autoIncrement: true });
        c.createIndex('painel', 'painel');
        db.createObjectStore('listas', { keyPath: 'nome' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

const pedido = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

async function loja(nome: Loja, modo: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  return (await abrir()).transaction(nome, modo).objectStore(nome);
}

export const agora = () => new Date().toISOString();

export async function gravarColeta(rec: Coleta): Promise<number> {
  return (await pedido((await loja('coletas', 'readwrite')).put(rec))) as number;
}

// coletas de um painel em ordem de id (mais antiga primeiro)
export async function coletasDe(painel: string): Promise<ColetaGravada[]> {
  const l: ColetaGravada[] = await pedido((await loja('coletas')).index('painel').getAll(painel));
  return l.sort((a, b) => a.id - b.id);
}

export async function todasColetas(): Promise<ColetaGravada[]> {
  return pedido((await loja('coletas')).getAll());
}

export async function ultimaOk(painel: string): Promise<ColetaGravada | null> {
  const l = await coletasDe(painel);
  for (let i = l.length - 1; i >= 0; i--) if (l[i].status === 'OK' || l[i].status === 'PARCIAL') return l[i];
  return null;
}

export async function gravarLista(lista: Lista) {
  return pedido((await loja('listas', 'readwrite')).put(lista));
}

export async function listas(): Promise<Listas> {
  const l: Lista[] = await pedido((await loja('listas')).getAll());
  return Object.fromEntries(l.map((x) => [x.nome, x]));
}

// Mantém: a última coleta de cada dia por painel (para tendências) nos últimos DIAS dias + as 3 mais recentes.
export async function podar(DIAS = 120): Promise<number> {
  const todas = await todasColetas();
  const porPainel: Record<string, ColetaGravada[]> = {};
  for (const c of todas) (porPainel[c.painel] = porPainel[c.painel] || []).push(c);
  const limite = new Date(Date.now() - DIAS * 864e5).toISOString();
  const apagar: number[] = [];
  for (const l of Object.values(porPainel)) {
    l.sort((a, b) => a.id - b.id);
    const recentes = new Set(l.slice(-3).map((c) => c.id));
    const ultimaDoDia: Record<string, number> = {};
    for (const c of l) ultimaDoDia[c.iniciada.slice(0, 10)] = c.id;
    const manter = new Set(Object.values(ultimaDoDia));
    for (const c of l) if (!recentes.has(c.id) && (!manter.has(c.id) || c.iniciada < limite)) apagar.push(c.id);
  }
  if (apagar.length) {
    const s = await loja('coletas', 'readwrite');
    await Promise.all(apagar.map((id) => pedido(s.delete(id))));
  }
  return apagar.length;
}

export async function apagarTudo() {
  const db = await abrir();
  await Promise.all((['coletas', 'listas'] as const).map((n) => pedido(db.transaction(n, 'readwrite').objectStore(n).clear())));
}
