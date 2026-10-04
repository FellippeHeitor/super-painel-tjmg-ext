import { prefs, salvarPrefs, paineis } from '../src/config.js';
import { Navegador } from '../src/qlik.js';
import { valoresDoCampo, normalizar } from '../src/comarca.js';
import { nomeComarca } from '../src/dados.js';
import * as rotina from '../src/rotina.js';
import * as db from '../src/db.js';
import type { NivelLog } from '../src/tipos.js';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const REFERENCIA = 'dados_estrategicos';   // painel com todas as comarcas do 1º grau (PJe/SEEU/SISCOM)
const auto = new URLSearchParams(location.search).get('auto') === '1';

function log(texto: string, nivel: NivelLog = '') {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString('pt-BR')} · ${texto}`;
  if (nivel) li.className = nivel;
  $('log').append(li);
  li.scrollIntoView({ block: 'nearest' });
}

const botoes = () => ['btSalvar', 'btLista', 'btTudo', 'btDevidos', 'btApagar'].map((id) => $<HTMLButtonElement>(id));
const ocupar = (sim: boolean) => botoes().forEach((b) => { b.disabled = sim; });

function mostrarComarca(c: string | null) {
  $('topo-comarca').textContent = c ? 'Comarca de ' + nomeComarca(c) : '';
  if (c) $<HTMLInputElement>('inComarca').value = c;
}

async function carregarLista() {
  $('stComarca').textContent = 'Lendo a lista de comarcas no Qlik…';
  const p = (await paineis())[REFERENCIA];
  const nav = new Navegador();
  try {
    const lista = [...new Set(await valoresDoCampo(nav, p, p.campoComarca))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    await salvarPrefs({ comarcas: lista });
    preencher(lista);
    $('stComarca').textContent = `${lista.length} comarcas disponíveis.`;
  } finally {
    await nav.fechar();
  }
}

function preencher(lista: string[]) {
  $('dlComarcas').replaceChildren(...lista.map((c) => Object.assign(document.createElement('option'), { value: c })));
}

$('btLista').onclick = async () => {
  ocupar(true);
  try { await carregarLista(); } catch (e) { $('stComarca').textContent = 'Erro: ' + (e as Error).message; } finally { ocupar(false); }
};

$('btSalvar').onclick = async () => {
  const { comarca, comarcas } = await prefs();
  const v = comarcas.find((c) => normalizar(c) === normalizar($<HTMLInputElement>('inComarca').value));
  if (!v) { $('stComarca').textContent = 'Escolha um nome da lista (carregada do Qlik).'; return; }
  if (comarca && normalizar(comarca) !== normalizar(v)) {
    if (!confirm(`Trocar a comarca para ${nomeComarca(v)} apaga os dados coletados de ${nomeComarca(comarca)} neste navegador. Continuar?`)) return;
    await db.apagarTudo();
  }
  await salvarPrefs({ comarca: v });
  mostrarComarca(v);
  $('stComarca').textContent = `Comarca: ${nomeComarca(v)}. Agora clique em "Coletar agora".`;
};

async function rodar(opcoes: rotina.Opcoes) {
  ocupar(true);
  $('log').replaceChildren();
  try {
    const r = await rotina.executar(log, opcoes);
    if (r.codigo === 0 && !auto) {   // sem falhas: abre o painel sozinho; com falha, fica o log para o usuário ver o motivo
      log('Abrindo o painel…');
      setTimeout(() => { location.href = 'painel.html'; }, 1500);
    } else if (r.codigo !== 2) log('Abra o painel para ver os dados.', '');
    return r;
  } finally { ocupar(false); }
}
$('btTudo').onclick = () => rodar({ todos: true });
$('btDevidos').onclick = () => rodar({});

const ckAuto = $<HTMLInputElement>('ckAuto');
$('btAuto').onclick = async () => {
  const horarios = $<HTMLInputElement>('inHorarios').value.split(/[,;\s]+/).filter(Boolean);
  if (!horarios.every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h))) { $('stAuto').textContent = 'Use o formato HH:MM, separados por vírgula.'; return; }
  await salvarPrefs({ automatico: ckAuto.checked, horarios });
  await chrome.runtime.sendMessage({ tipo: 'agendar' });
  $('stAuto').textContent = ckAuto.checked ? `Coleta automática às ${horarios.join(', ')}.` : 'Coleta automática desligada.';
};
ckAuto.onchange = () => $('btAuto').click();

$('btApagar').onclick = async () => {
  if (!confirm('Apagar todas as coletas e relações de processos deste navegador?')) return;
  await db.apagarTudo();
  $('stApagar').textContent = 'Dados locais apagados.';
};

// ---- partida
const p = await prefs();
preencher(p.comarcas);
mostrarComarca(p.comarca);
ckAuto.checked = p.automatico;
$<HTMLInputElement>('inHorarios').value = p.horarios.join(', ');
if (auto) {
  log('Coleta automática.');
  const r = await rodar({});
  if (r.codigo === 0) setTimeout(() => window.close(), 5000);   // com falha, a aba fica aberta para o usuário ver o motivo
} else if (!p.comarcas.length) {
  ocupar(true);
  try { await carregarLista(); } catch (e) { $('stComarca').textContent = 'Não foi possível ler a lista de comarcas: ' + (e as Error).message; } finally { ocupar(false); }
} else if (!p.comarca) {
  $('stComarca').textContent = 'Escolha a comarca.';
}
