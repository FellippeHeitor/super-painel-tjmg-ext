// Configuração dos painéis (config/paineis.json, convertida do robô) e preferências do usuário (chrome.storage.local).
import type { Paineis, Prefs } from './tipos.js';

let cache: Paineis | null = null;

export async function paineis(): Promise<Paineis> {
  if (!cache) {
    const r = await fetch(chrome.runtime.getURL('config/paineis.json'));
    cache = (await r.json()).paineis as Paineis;
  }
  return cache;
}

export const PREF_PADRAO: Prefs = { comarca: null, comarcas: [], automatico: true, horarios: ['07:00', '09:00'] };

export async function prefs(): Promise<Prefs> {
  const p = await chrome.storage.local.get(Object.keys(PREF_PADRAO));
  return { ...PREF_PADRAO, ...p };
}

export const salvarPrefs = (p: Partial<Prefs>) => chrome.storage.local.set(p);
