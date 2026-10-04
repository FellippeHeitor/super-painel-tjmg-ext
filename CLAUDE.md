# Super Painel TJMG — extensão

Extensão Chrome MV3 que substitui o robô Python/Playwright do Super Painel TJMG, criado por Bernardo Vieira (autor original da funcionalidade: mapeamento dos painéis Qlik, campos, KPIs, expressões e o painel web, que esta extensão reaproveita). Ao mudar algo herdado do robô, preservar o crédito no README.

Regras: código e comentários em português; nunca inventar campos/valores/seletores do Qlik; nunca exibir números sem o filtro da comarca confirmado (`GetSelectedCount`); nenhum dado em repositório ou servidor (LGPD): tudo fica no navegador; robustez > velocidade.

Decisões (04/10/2026):
- GitHub Pages público descartado para dados (sem controle de acesso; listas têm processos em segredo de justiça). Extensão escolhida.
- Personalização SÓ por comarca (sem escolha de vara); o filtro "Órgão Julgador" do robô antigo não é usado.
- Grafia da comarca resolvida por app (sem acento/maiúsculas, exatamente 1 equivalente), com cache em chrome.storage.local (`grafia|COMARCA|appid|campo`); se a seleção não pegar, resolve de novo uma vez.
- O Qlik do TJMG é acessível fora da Rede TJMG (confirmado pelo usuário e em teste automatizado).

Mecanismo: `src/gancho-ws.js` (content script, world MAIN, document_start) anota a URL do WebSocket da Engine; `src/qlik.js` mantém UMA aba de trabalho em segundo plano e executa `src/engine.js` nela via `chrome.scripting.executeScript({world: 'MAIN'})`. `engine.js` é serializado pelo Chrome: não pode depender de nada fora da função. A rotina roda numa página da extensão (`pages/coleta.html`, `?auto=1` quando disparada pelo alarme), não no service worker (limite de vida do SW).

Front-end: `pages/painel/*.js` são os templates do site antigo com mudanças mínimas (`D`/`P` vêm de `window.__D`/`__P`, montados por `carregar.js` com `src/dados.js`; textos sem "Minas Novas"/"mar/2026" fixos; `M.eproc_inicio` = 1º mês com distribuição no eProc). Sem script inline (CSP do MV3).

Teste automatizado: Playwright em cache (`~/.npm/_npx/.../playwright-core` 1.61) + Chrome for Testing 1228, `--load-extension`, headless. Harness no scratchpad da sessão (não versionado).

Pendências: ícones; XLSX das listas (hoje só CSV pelo painel); publicar na Chrome Web Store (não listada) se a política do TJMG bloquear "Carregar sem compactação".
