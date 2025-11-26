// Browser shim for local development. Implements the same API as the VS Code shim.
(function(){
  const listeners = [];
  window.__APP_MESSAGING__ = {
    postMessage(msg) {
      // In browser mode emit a local event for testing
      // Also dispatch a window message so other frames/dev tools can pick it up
      window.dispatchEvent(new MessageEvent('message', { data: msg }));
    },
    onMessage(handler) {
      if (typeof handler === 'function') listeners.push(handler);
    }
  };
  // Provide backwards-compatible `window.vscodeApi.postMessage` used by bundled fetchers
  try {
    window.vscodeApi = window.vscodeApi || {};
    window.vscodeApi.postMessage = function(m) {
      try { window.__APP_MESSAGING__.postMessage(m); } catch (e) { /* ignore */ }
    };
  } catch (e) {
    // ignore
  }
  window.addEventListener('message', (ev) => { try { listeners.forEach(h => h(ev.data)); } catch(e) { /* ignore */ } });
})();
