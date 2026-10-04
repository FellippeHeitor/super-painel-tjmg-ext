# Super Painel TJMG — extensão

Extensão Chrome MV3 que substitui o robô Python/Playwright do Super Painel TJMG, criado por Bernardo Vieira (autor original da funcionalidade: mapeamento dos painéis Qlik, campos, KPIs, expressões e o painel web, que esta extensão reaproveita). Ao mudar algo herdado do robô, preservar o crédito no README.

Regras: código e comentários em português; nunca inventar campos/valores/seletores do Qlik; nunca exibir números sem o filtro da comarca confirmado (`GetSelectedCount`); nenhum dado em repositório ou servidor (LGPD): tudo fica no navegador; robustez > velocidade.

Decisões (04/10/2026):
- GitHub Pages público descartado para dados (sem controle de acesso; listas têm processos em segredo de justiça). Extensão escolhida.
- Personalização SÓ por comarca (sem escolha de vara); o filtro "Órgão Julgador" do robô antigo não é usado.
- Grafia da comarca resolvida por app (sem acento/maiúsculas, exatamente 1 equivalente), com cache em chrome.storage.local (`grafia|COMARCA|appid|campo`); se a seleção não pegar, resolve de novo uma vez.
- O Qlik do TJMG é acessível fora da Rede TJMG (confirmado pelo usuário e em teste automatizado).

Código em TypeScript (`tsc`, sem bundler): `npm run build` gera `dist/` (não versionado desde 04/10/2026: é refeito a cada build), que é a pasta carregada no Chrome (não mudar: outra pasta = outro ID de extensão = perde o IndexedDB); `npm run check` só verifica tipos. Tipos compartilhados em `src/tipos.ts`. Os templates `pages/painel/0*-90*.js` continuam em JS, versionados, e o build os copia para `dist/`.

Mecanismo: `src/gancho-ws.ts` (content script, world MAIN, document_start) anota a URL do WebSocket da Engine; `src/qlik.ts` cria UM iframe invisível (fora da tela, 1280×800) na página que roda a coleta, sem abrir abas, e conversa por `postMessage` com `src/engine.ts`, content script world MAIN em todos os frames (`all_frames`), que só responde quando é iframe de página `chrome-extension://`. `gancho-ws.ts` e `engine.ts` são scripts clássicos (sem import/export; tipos via `import('./tipos.js')`). Nova tentativa = iframe novo. Sem a permissão `scripting`. A rotina roda numa página da extensão (`pages/coleta.html`, `?auto=1` quando disparada pelo alarme), não no service worker (limite de vida do SW).

Front-end: `pages/painel/*.js` são os templates do site antigo com mudanças mínimas (`D`/`P` vêm de `window.__D`/`__P`, montados por `carregar.ts` com `src/dados.ts`; textos sem "Minas Novas"/"mar/2026" fixos; `M.eproc_inicio` = 1º mês com distribuição no eProc). Sem script inline (CSP do MV3).

Teste automatizado: Playwright em cache (`~/.npm/_npx/.../playwright-core` 1.61) + Chrome for Testing 1228, `--load-extension`, headless. Harness no scratchpad da sessão (não versionado).

Exportação das listas: CSV e XLSX (`src/xlsx.ts`, gerado no navegador, exposto como `window.__xlsx`). Google Planilhas descartado (04/10/2026): enviaria as listas, com processos em segredo de justiça, a servidor do Google.

Ícones (04/10/2026): triângulo da bandeira de Minas com a linha de crescimento saindo dele (sem lema, brasão ou logo do TJMG, para não parecer oficial). Fontes em `icones/*.svg` (`super-painel-16.svg` é redesenhado para 16/32 px, não reduzir o grande); `node scripts/icones.mjs` gera os PNG versionados rasterizando no Chrome via playwright-core; o build copia os PNG e o SVG grande (logo no topo do painel e da coleta). Identidade: topo e lateral em azul-marinho `#131f36`; o vermelho de Minas `#d32f2f` (`--minas`) só na marca (logo e faixa sob o topo), nunca em botão/aba/gráfico, porque vermelho na interface é `--crit`.

Pendências: publicar na Chrome Web Store (não listada) se a política do TJMG bloquear "Carregar sem compactação".
