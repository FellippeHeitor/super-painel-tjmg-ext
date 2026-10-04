# Super Painel TJMG (extensão do Chrome)

Extensão que lê os painéis Qlik Sense do TJMG **direto do navegador** e monta um painel de indicadores da comarca escolhida: movimentação por sistema (PJe, eProc, SEEU, SISCOM), conclusões por dia e por mês, tarefas e documentos pendentes, acervo, migração PJe → eProc, apoio ao planejamento e Metas Nacionais do CNJ. Inclui as relações de processos, com busca, filtros e exportação em CSV.

- **Sem servidor e sem dados no repositório.** A coleta roda numa aba do `qlik.tjmg.jus.br` aberta em segundo plano pela extensão. Números e relações de processos ficam só no IndexedDB deste navegador.
- **Qualquer comarca.** A lista vem do próprio Qlik. A grafia de cada painel ("ESPERA FELIZ" x "Espera Feliz") é resolvida automaticamente, sem diferenciar acentos nem maiúsculas. Se não houver equivalente exato, o painel não é coletado.
- **Salvaguarda.** Se o filtro da comarca não pegar, a coleta daquele painel falha e nada é gravado (senão viriam números do estado inteiro).

Sucessor do robô em Python/Playwright do Super Painel TJMG, que exigia um PC dedicado, o SQLite e a publicação no Cloudflare.

## Instalar

1. `chrome://extensions` → ligar o **Modo do desenvolvedor**.
2. **Carregar sem compactação** → selecionar esta pasta.
3. Clicar no ícone da extensão → abre o painel. Na primeira vez: **Escolher a comarca e coletar os dados**.

## Uso

- **Atualizar dados** (no topo do painel) → página de coleta: comarca, "Coletar agora" (todos os painéis; alguns minutos) ou "Só o que está devido" (respeita a frequência de cada painel).
- **Coleta automática:** por padrão às 07:00 e 09:00, enquanto o Chrome estiver aberto. Abre a página de coleta em segundo plano, que fecha sozinha se tudo der certo.
- **Trocar de comarca** apaga os dados da comarca anterior neste navegador.

## Estrutura

| Arquivo | Função |
|---|---|
| `manifest.json` | MV3; permissões `tabs`, `scripting`, `storage`, `alarms`; acesso só a `qlik.tjmg.jus.br` |
| `config/paineis.json` | appid/sheet, campo de comarca, KPIs, séries e frequência de cada painel (convertido do robô) |
| `config/site.json` | seções do painel por painel de origem (lista de permissão) |
| `src/gancho-ws.js` | roda na página do Qlik e anota a URL do WebSocket da Engine (com o token CSRF da sessão anônima) |
| `src/qlik.js` | aba de trabalho em segundo plano, repetição de tentativas, diálogo "Conexão perdida" |
| `src/engine.js` | jobs na Engine API (seleções, KPIs, séries, tabelas, valores de campo), roda dentro da aba do Qlik |
| `src/comarca.js` | grafia da comarca em cada app (com cache) |
| `src/coleta.js`, `src/conclusoes.js`, `src/listas.js` | coleta por painel, conclusões PJe + eProc, relações de processos e listas do Apoio sem duplicidade |
| `src/rotina.js` | rotina completa (painéis devidos + conclusões + Apoio), com trava contra execução dupla |
| `src/db.js` | IndexedDB: histórico de coletas (última de cada dia, 120 dias) e relações de processos |
| `src/dados.js` | monta os dados do painel a partir das coletas (porte do `site.py`) |
| `pages/painel.html`, `pages/painel/*.js` | o painel (o mesmo front-end do site anterior) |
| `pages/coleta.*` | comarca, coleta com progresso, agendamento, apagar dados |

## Créditos

- **Bernardo Vieira**: criador do Super Painel TJMG. A ideia, o robô original de coleta, o mapeamento dos painéis Qlik (campos, indicadores e expressões) e o painel web que esta extensão reaproveita.
- **Fellippe Heitor**: extensão do Chrome, que leva esse trabalho para dentro do navegador e o torna utilizável por qualquer comarca.
