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
    
    // Global link click interception for external URLs
    // Intercept clicks on <a> tags and elements with data-gh-open attribute
    document.addEventListener('click', (ev) => {
      try {
        let target = ev.target;
        // Traverse up to find an <a> tag or element with data-gh-open
        while (target && target !== document.body) {
          // Check for data-gh-open attribute (used for parent_issue, repository, etc.)
          if (target.hasAttribute && target.hasAttribute('data-gh-open')) {
            const url = target.getAttribute('data-gh-open');
            if (url && url.trim()) {
              ev.preventDefault();
              ev.stopPropagation();
              vscode.postMessage({ command: 'openUrl', url: url.trim() });
              return;
            }
          }
          // Check for <a> tags with href
          if (target.tagName === 'A' && target.href) {
            const href = target.href;
            // Only intercept http/https URLs (external links)
            if (href.startsWith('http://') || href.startsWith('https://')) {
              ev.preventDefault();
              ev.stopPropagation();
              vscode.postMessage({ command: 'openUrl', url: href });
              return;
            }
          }
          target = target.parentElement;
        }
      } catch (e) { /* ignore */ }
    });
  } catch (e) {
    /* init failed silently */
  }
})();
