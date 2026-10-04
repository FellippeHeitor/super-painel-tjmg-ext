// Roda no contexto da página do Qlik (world MAIN) antes de qualquer script dela.
// Só ANOTA as URLs de WebSocket da Engine que a página abre (com o qlik-csrf-token da sessão anônima),
// para que src/qlik.ts abra o seu próprio WebSocket igual. Não altera nem lê o tráfego.
// Content script clássico (não módulo): sem import/export neste arquivo.
(() => {
  const Orig = window.WebSocket as typeof WebSocket & { __superPainel?: boolean };
  if (!Orig || Orig.__superPainel) return;
  const urls = (window.__superPainelWs = window.__superPainelWs || []);
  class WebSocketAnotado extends Orig {
    static __superPainel = true;
    constructor(url: string | URL, protocolos?: string | string[]) {
      super(url, protocolos);
      try {
        const u = String(url);
        if (u.includes('/app/') && !urls.includes(u)) urls.push(u);
      } catch (e) { /* nada */ }
    }
  }
  window.WebSocket = WebSocketAnotado;
})();
