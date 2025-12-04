// Shim to adapt VS Code webview `acquireVsCodeApi` to window.__APP_MESSAGING__
(function(){
  try {
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
    if(!vscode) return;
    const listeners = [];
    window.__APP_MESSAGING__ = {
      postMessage(msg) {
        try { vscode.postMessage(msg); } catch(e) { /* ignore */ }
      },
      onMessage(handler) {
        if (typeof handler === 'function') listeners.push(handler);
      }
    };
    // Backwards-compat: some bundled fetchers use `window.vscodeApi.postMessage`.
    // Provide a small compatibility object that forwards to the same API.
    try {
      window.vscodeApi = window.vscodeApi || {};
      window.vscodeApi.postMessage = function(m) {
        try { vscode.postMessage(m); } catch (e) { /* ignore */ }
      };
    } catch (e) { /* ignore */ }
    window.addEventListener('message', (ev) => {
      try { const d = ev.data; listeners.forEach(h=>h(d)); } catch(e) { /* ignore */ }
    });
  } catch (e) {
    /* init failed silently */
  }
})();
