// Monta a extensão em dist/ (é essa pasta que se carrega em chrome://extensions → "Carregar sem compactação").
// O TypeScript (src/, pages/coleta.ts, pages/painel/carregar.ts) é compilado pelo tsc; o resto é copiado como está.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, readdirSync, existsSync } from 'node:fs';

const DIST = 'dist';
rmSync(DIST, { recursive: true, force: true });

// tsc local (node_modules) se houver; senão o do PATH
const tsc = ['node_modules/.bin/tsc', 'tsc'];
let compilou = false;
for (const bin of tsc) {
  try { execFileSync(bin, ['-p', 'tsconfig.json'], { stdio: 'inherit' }); compilou = true; break; } catch (e) {
    if (e.code !== 'ENOENT') process.exit(1);   // erro de tipo/compilação: para aqui
  }
}
if (!compilou) { console.error('tsc não encontrado: rode npm install'); process.exit(1); }

cpSync('manifest.json', `${DIST}/manifest.json`);
cpSync('config', `${DIST}/config`, { recursive: true });
// ícones: os PNG (manifest) e o SVG grande, que é a logo no topo das páginas (o SVG de 16 px e o gerador ficam fora; ver scripts/icones.mjs)
for (const f of readdirSync('icones')) if (f.endsWith('.png') || f === 'super-painel.svg') cpSync(`icones/${f}`, `${DIST}/icones/${f}`);
for (const f of readdirSync('pages')) if (f.endsWith('.html') || f.endsWith('.css')) cpSync(`pages/${f}`, `${DIST}/pages/${f}`);
// templates do painel antigo: continuam em JavaScript (mudanças mínimas). Pula .js que tenha .ts (ex.: carregar.js velho), senão sobrescreveria o compilado.
for (const f of readdirSync('pages/painel')) if (f.endsWith('.js') && !existsSync(`pages/painel/${f.slice(0, -3)}.ts`)) cpSync(`pages/painel/${f}`, `${DIST}/pages/painel/${f}`);
console.log(`extensão montada em ${DIST}/`);
