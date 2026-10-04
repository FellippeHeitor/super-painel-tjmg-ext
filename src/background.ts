// Service worker: abre o painel ao clicar no ícone e agenda a coleta automática (chrome.alarms).
// A coleta em si roda numa página da extensão (pages/coleta.html?auto=1), aberta em segundo plano.
import { prefs } from './config.js';

const PREFIXO = 'coleta-';

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/painel.html') });
});

// próximo horário HH:MM (hoje, se ainda não passou; senão amanhã)
function proximo(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

async function agendar() {
  for (const a of await chrome.alarms.getAll()) if (a.name.startsWith(PREFIXO)) await chrome.alarms.clear(a.name);
  const p = await prefs();
  if (!p.automatico || !p.comarca) return;
  for (const h of p.horarios) await chrome.alarms.create(PREFIXO + h, { when: proximo(h), periodInMinutes: 24 * 60 });
}

chrome.alarms.onAlarm.addListener(async (a) => {
  if (!a.name.startsWith(PREFIXO)) return;
  // alarme muito atrasado (computador estava desligado/suspenso): ainda coleta, a rotina só pega o que está devido
  const url = chrome.runtime.getURL('pages/coleta.html?auto=1');
  const abertas = await chrome.tabs.query({ url: chrome.runtime.getURL('pages/coleta.html') + '*' });
  if (abertas.length) return;   // já há uma página de coleta aberta
  await chrome.tabs.create({ url, active: false });
});

chrome.runtime.onMessage.addListener((msg: { tipo?: string } | undefined, _rem, responder) => {
  if (msg && msg.tipo === 'agendar') { agendar().then(() => responder(true)); return true; }
  return false;
});

chrome.runtime.onInstalled.addListener(agendar);
chrome.runtime.onStartup.addListener(agendar);
chrome.storage.onChanged.addListener((mud, area) => { if (area === 'local' && mud.comarca) agendar(); });
