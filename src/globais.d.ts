// Globais da janela: URLs anotadas por gancho-ws.ts (na página do Qlik) e D/P/__xlsx do painel (montados por carregar.ts).
interface Window {
  __superPainelWs?: string[];
  __D?: unknown;
  __P?: unknown;
  __xlsx?: (colunas: string[], linhas: (string | number | null | undefined)[][], aba?: string) => Blob;
}
