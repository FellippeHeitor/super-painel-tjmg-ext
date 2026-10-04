// Gera icones/icone-{16,32,48,128}.png a partir dos SVG de icones/ (rodar só quando o desenho mudar; os PNG são versionados).
// Rasteriza no próprio Chrome (canvas), o mesmo motor que desenha o ícone na barra. Usa o playwright-core já instalado:
//   node scripts/icones.mjs            (procura o playwright-core no cache do npx)
//   PLAYWRIGHT_CORE=/caminho/playwright-core node scripts/icones.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function acharPlaywright() {
  if (process.env.PLAYWRIGHT_CORE) return process.env.PLAYWRIGHT_CORE;
  const npx = join(homedir(), '.npm', '_npx');
  for (const d of existsSync(npx) ? readdirSync(npx) : []) {
    const p = join(npx, d, 'node_modules', 'playwright-core');
    if (existsSync(p)) return p;
  }
  console.error('playwright-core não encontrado: rode "npx playwright-core install chromium" ou defina PLAYWRIGHT_CORE');
  process.exit(1);
}

// tamanho → desenho de origem (16 e 32 usam a versão redesenhada para a grade pequena)
const TAMANHOS = { 16: 'super-painel-16.svg', 32: 'super-painel-16.svg', 48: 'super-painel.svg', 128: 'super-painel.svg' };

const { chromium } = await import(pathToFileURL(join(acharPlaywright(), 'index.mjs')).href);
const navegador = await chromium.launch({ headless: true });
const pagina = await navegador.newPage();
for (const [px, arq] of Object.entries(TAMANHOS)) {
  const svg = readFileSync(join('icones', arq), 'utf8');
  const base64 = await pagina.evaluate(async ({ svg, px }) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(img, 0, 0, px, px);
    return c.toDataURL('image/png').split(',')[1];
  }, { svg, px: Number(px) });
  writeFileSync(join('icones', `icone-${px}.png`), Buffer.from(base64, 'base64'));
  console.log(`icones/icone-${px}.png`);
}
await navegador.close();
