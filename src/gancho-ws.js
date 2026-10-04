// Roda no contexto da página do Qlik (world MAIN) antes de qualquer script dela.
// Só ANOTA as URLs de WebSocket da Engine que a página abre (com o qlik-csrf-token da sessão anônima),
// para que src/qlik.js abra o seu próprio WebSocket igual. Não altera nem lê o tráfego.
(() => {
  const Orig = window.WebSocket;
  if (!Orig || Orig.__superPainel) return;
  const urls = (window.__superPainelWs = window.__superPainelWs || []);
  class WebSocketAnotado extends Orig {
    constructor(url, protocolos) {
      super(url, protocolos);
      try {
        const u = String(url);
        if (u.includes('/app/') && !urls.includes(u)) urls.push(u);
      } catch (e) { /* nada */ }
    }
  }
  WebSocketAnotado.__superPainel = true;
  window.WebSocket = WebSocketAnotado;
})();
