// Monta a extensão em dist/ (é essa pasta que se carrega em chrome://extensions → "Carregar sem compactação").
// O TypeScript (src/, pages/coleta.ts, pages/painel/carregar.ts) é compilado pelo tsc; o resto é copiado como está.
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, readdirSync } from 'node:fs';

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
for (const f of readdirSync('pages')) if (f.endsWith('.html') || f.endsWith('.css')) cpSync(`pages/${f}`, `${DIST}/pages/${f}`);
// templates do painel antigo: continuam em JavaScript (mudanças mínimas)
for (const f of readdirSync('pages/painel')) if (f.endsWith('.js')) cpSync(`pages/painel/${f}`, `${DIST}/pages/painel/${f}`);
console.log(`extensão montada em ${DIST}/`);
