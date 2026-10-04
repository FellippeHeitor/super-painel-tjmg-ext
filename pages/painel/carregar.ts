// Monta os dados a partir do IndexedDB e só então carrega os scripts do painel (clássicos, em ordem; usam D/P globais).
// Sem coleta ainda: vai direto para a página de coleta (escolher a comarca e coletar).
import { montar } from '../../src/dados.js';
import { xlsx } from '../../src/xlsx.js';

const SCRIPTS = ['00_base.js', '10_dados.js', '20_visao.js', '30_processos.js', '40_views.js', '90_main.js'];

function carregarEmOrdem(lista: string[]): Promise<unknown> {
  return lista.reduce<Promise<unknown>>((p, arq) => p.then(() => new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'painel/' + arq;
    s.onload = ok;
    s.onerror = () => erro(new Error('falha ao carregar ' + arq));
    document.body.append(s);
  })), Promise.resolve());
}

function semDados(msg: string) {
  // style.display, não `hidden`: o CSS do painel (.shell{display:grid}) sobrepõe o atributo hidden
  (document.querySelector('.shell') as HTMLElement).style.display = 'none';
  (document.getElementById('rodape') as HTMLElement).style.display = 'none';
  const caixa = document.createElement('div');
  caixa.className = 'vazio';
  const logo = document.createElement('img'); logo.className = 'logo'; logo.src = '../icones/super-painel.svg'; logo.width = logo.height = 72; logo.alt = '';
  const h = document.createElement('h1'); h.textContent = 'Super Painel TJMG';
  const p = document.createElement('p'); p.textContent = msg;
  const a = document.createElement('a'); a.href = 'coleta.html'; a.textContent = 'Escolher a comarca e coletar os dados'; a.className = 'btn';
  caixa.append(logo, h, p, a);
  document.body.append(caixa);
}

const r = await montar().catch((e: unknown) => ({ erro: e as Error }));
if (!r) location.replace('coleta.html');
else if ('erro' in r) semDados('Não foi possível ler os dados locais: ' + (r.erro.message || r.erro));
else {
  window.__D = r.D;
  window.__P = r.P;
  window.__xlsx = xlsx;   // exportação XLSX das listas (30_processos.js)
  (document.getElementById('brand-comarca') as HTMLElement).textContent = 'COMARCA DE ' + r.D.comarca.toUpperCase();
  await carregarEmOrdem(SCRIPTS);
}
