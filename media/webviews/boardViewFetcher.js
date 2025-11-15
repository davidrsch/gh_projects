// Static board view fetcher (placeholder)
// Provide a named function and attach to `window` so bundlers can parse the file
function boardViewFetcher(view, container, viewKey) {
  const project = window.__project_data__ || window.project || {};
  container.innerHTML =
    '<div class="title">' + (view.name || view.id || 'Board View') + '</div>' +
    '<div class="loading"><em>Loading board…</em></div>';

  let currentFirst = 50;

  function escapeHtml(s) {
    return s
      ? String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      : '';
  }

  function renderSnapshot(snapshot) {
    try {
      const items = (snapshot && snapshot.items) || [];
      container.innerHTML =
        '<div class="title">' + (view.name || view.id || 'Board View') + '</div>' +
        '<div><strong>Items:</strong> ' + items.length + '</div>';
      const list = document.createElement('div');
      list.style.marginTop = '8px';
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const el = document.createElement('div');
        el.style.padding = '6px 8px';
        el.style.border = '1px solid var(--vscode-editorWidget-border)';
        el.style.marginBottom = '6px';
        const title =
          (it && it.content && (it.content.title || it.content.name)) ||
          (it && it.title) ||
          (it && it.raw && it.raw.title) ||
          ('#' + (i + 1));
        el.innerHTML =
          '<div style="font-weight:600">' + escapeHtml(String(title || '')) + '</div>' +
          '<div style="color:var(--vscode-descriptionForeground);font-size:12px">' +
          escapeHtml(String((it && it.id) || '')) +
          '</div>';
        list.appendChild(el);
      }
      container.appendChild(list);
    } catch (e) {
      container.innerHTML =
        '<div class="title">' + (view.name || view.id || 'Board View') + '</div>' +
        '<div>Error rendering snapshot</div>';
    }
  }

  function onMessage(e) {
    const event = e && e.data ? e.data : e;
    try {
      if (
        window.vscodeApi &&
        typeof window.vscodeApi.postMessage === 'function'
      ) {
        window.vscodeApi.postMessage({
          command: 'debugLog',
          level: 'debug',
          viewKey,
          message: 'boardViewFetcher.onMessage',
          data: { command: event && event.command, eventViewKey: event && event.viewKey },
        });
      }
    } catch (_err) {}
    try {
      console.log('boardViewFetcher.onMessage', { cmd: event && event.command, viewKey: event && event.viewKey });
    } catch (_err) {}
    if (!event) return;
    if (event.command === 'fields') {
      if (event.viewKey && viewKey && String(event.viewKey) !== String(viewKey)) return;
      if (event.error) {
        container.innerHTML =
          '<div class="title">' + (view.name || view.id || 'Board View') + '</div>' +
          '<div style="color:var(--vscode-editor-foreground)">' + String(event.error) + '</div>';
      } else {
        renderSnapshot(event.payload || event.payload?.data || event.payload);
      }
    }
  }

  function requestFields() {
    try {
      try {
        if (
          window.vscodeApi &&
          typeof window.vscodeApi.postMessage === 'function'
        ) {
          window.vscodeApi.postMessage({
            command: 'debugLog',
            level: 'debug',
            viewKey,
            message: 'boardViewFetcher.requestFields',
            data: { first: currentFirst },
          });
        }
      } catch (_err) {}
      try {
        console.log('boardViewFetcher.requestFields', { viewKey, first: currentFirst });
      } catch (_err) {}
      if (typeof acquireVsCodeApi === 'function' || (window.vscodeApi && typeof window.vscodeApi.postMessage === 'function')) {
        try {
          if (window.vscodeApi && typeof window.vscodeApi.postMessage === 'function')
            window.vscodeApi.postMessage({ command: 'requestFields', first: currentFirst, viewKey: viewKey });
          else if (typeof acquireVsCodeApi === 'function') {
            const api = acquireVsCodeApi();
            api.postMessage({ command: 'requestFields', first: currentFirst, viewKey: viewKey });
          }
        } catch (err) {}
      }
    } catch (err) {}
  }

  window.addEventListener('message', onMessage);
  // initial request
  requestFields();
}

// keep the old global API so the loader (`contentFetcher.js`) can continue to call `window.boardViewFetcher`
try {
  window.boardViewFetcher = boardViewFetcher;
} catch (e) {
  /* ignore */
}
