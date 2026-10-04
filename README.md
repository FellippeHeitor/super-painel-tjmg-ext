# Super Painel TJMG (extensão do Chrome)

Extensão que lê os painéis Qlik Sense do TJMG **direto do navegador** e monta um painel de indicadores da comarca escolhida: movimentação por sistema (PJe, eProc, SEEU, SISCOM), conclusões por dia e por mês, tarefas e documentos pendentes, acervo, migração PJe → eProc, apoio ao planejamento e Metas Nacionais do CNJ. Inclui as relações de processos, com busca, filtros e exportação em CSV e XLSX (gerados no navegador).

- **Sem servidor e sem dados no repositório.** A coleta abre o `qlik.tjmg.jus.br` num quadro invisível dentro da própria página de coleta, sem abrir abas. Números e relações de processos ficam só no IndexedDB deste navegador.
- **Qualquer comarca.** A lista vem do próprio Qlik. A grafia de cada painel ("ESPERA FELIZ" x "Espera Feliz") é resolvida automaticamente, sem diferenciar acentos nem maiúsculas. Se não houver equivalente exato, o painel não é coletado.
- **Salvaguarda.** Se o filtro da comarca não pegar, a coleta daquele painel falha e nada é gravado (senão viriam números do estado inteiro).

Sucessor do robô em Python/Playwright do Super Painel TJMG, que exigia um PC dedicado, o SQLite e a publicação no Cloudflare.

## Instalar

1. `npm install` e `npm run build` (o código é TypeScript; a extensão pronta fica em `dist/`). Depois de mudar um `.ts`: `npm run build` (ou `npm run watch`) e recarregar a extensão.
2. `chrome://extensions` → ligar o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → selecionar a pasta `dist/`.
4. Clicar no ícone da extensão → abre o painel. Na primeira vez: **Escolher a comarca e coletar os dados**.

## Uso

- **Atualizar dados** (no topo do painel) → página de coleta: comarca, "Coletar agora" (todos os painéis; alguns minutos) ou "Só o que está devido" (respeita a frequência de cada painel).
- **Coleta automática:** por padrão às 07:00 e 09:00, enquanto o Chrome estiver aberto. Abre a página de coleta em segundo plano, que fecha sozinha se tudo der certo.
- **Trocar de comarca** apaga os dados da comarca anterior neste navegador.

## Estrutura

| Arquivo | Função |
|---|---|
| `manifest.json` | MV3; permissões `tabs`, `storage`, `alarms`; acesso só a `qlik.tjmg.jus.br` |
| `config/paineis.json` | appid/sheet, campo de comarca, KPIs, séries e frequência de cada painel (convertido do robô) |
| `config/site.json` | seções do painel por painel de origem (lista de permissão) |
| `tsconfig.json` | TypeScript (`tsc`, sem bundler); os `.js` gerados não vão para o repositório |
| `src/tipos.ts` | tipos da config, dos jobs/resultados do engine e dos registros do IndexedDB |
| `src/gancho-ws.ts` | roda na página do Qlik (inclusive em iframe) e anota a URL do WebSocket da Engine (com o token CSRF da sessão anônima) |
| `src/qlik.ts` | iframe de trabalho invisível, conversa por `postMessage`, repetição de tentativas, diálogo "Conexão perdida" |
| `src/engine.ts` | jobs na Engine API (seleções, KPIs, séries, tabelas, valores de campo), roda dentro do iframe do Qlik e responde à página de coleta |
| `src/comarca.ts` | grafia da comarca em cada app (com cache) |
| `src/coleta.ts`, `src/conclusoes.ts`, `src/listas.ts` | coleta por painel, conclusões PJe + eProc, relações de processos e listas do Apoio sem duplicidade |
| `src/rotina.ts` | rotina completa (painéis devidos + conclusões + Apoio), com trava contra execução dupla |
| `src/db.ts` | IndexedDB: histórico de coletas (última de cada dia, 120 dias) e relações de processos |
| `src/xlsx.ts` | gera o .xlsx das listas no navegador (sem biblioteca externa) |
| `src/dados.ts` | monta os dados do painel a partir das coletas (porte do `site.py`) |
| `pages/painel.html`, `pages/painel/*.js` | o painel (o mesmo front-end do site anterior, mantido em JavaScript); `carregar.ts` monta os dados |
| `pages/coleta.*` | comarca, coleta com progresso, agendamento, apagar dados |

## Créditos

- **[Bernardo Vieira](https://github.com/bernardovieira1-droid)**: criador do Super Painel TJMG. A ideia, o robô original de coleta, o mapeamento dos painéis Qlik (campos, indicadores e expressões) e o painel web que esta extensão reaproveita.
- **Fellippe Heitor**: extensão do Chrome, que leva esse trabalho para dentro do navegador e o torna utilizável por qualquer comarca.
