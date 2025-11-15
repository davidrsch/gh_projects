// Static roadmap view fetcher (placeholder)
// Provide a named function and attach to `window` so bundlers can parse the file
function roadmapViewFetcher(view, container, viewKey) {
  container.innerHTML =
    '<div class="title">' + (view.name || view.id || 'Roadmap View') + '</div>' +
    '<div class="loading"><em>Loading roadmap…</em></div>';

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
        '<div class="title">' + (view.name || view.id || 'Roadmap View') + '</div>' +
        '<div><strong>Items:</strong> ' + items.length + '</div>';
      const ol = document.createElement('ol');
      ol.style.marginTop = '8px';
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const li = document.createElement('li');
        li.style.marginBottom = '6px';
        const title =
          (it && it.content && (it.content.title || it.content.name)) ||
          (it && it.title) ||
          (it && it.raw && it.raw.title) ||
          ('#' + (i + 1));
        li.innerHTML = '<div style="font-weight:600">' + escapeHtml(String(title || '')) + '</div>';
        ol.appendChild(li);
      }
      container.appendChild(ol);
    } catch (e) {
      container.innerHTML =
        '<div class="title">' + (view.name || view.id || 'Roadmap View') + '</div>' +
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
          message: 'roadmapViewFetcher.onMessage',
          data: { command: event && event.command, eventViewKey: event && event.viewKey },
        });
      }
    } catch (_err) {}
    try {
      console.log('roadmapViewFetcher.onMessage', { cmd: event && event.command, viewKey: event && event.viewKey });
    } catch (_err) {}
    if (!event) return;
    if (event.command === 'fields') {
      if (event.viewKey && viewKey && String(event.viewKey) !== String(viewKey)) return;
      if (event.error) {
        container.innerHTML =
          '<div class="title">' + (view.name || view.id || 'Roadmap View') + '</div>' +
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
            message: 'roadmapViewFetcher.requestFields',
            data: { first: currentFirst },
          });
        }
      } catch (_err) {}
      try {
        console.log('roadmapViewFetcher.requestFields', { viewKey, first: currentFirst });
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
  requestFields();
}

try {
  window.roadmapViewFetcher = roadmapViewFetcher;
} catch (e) {
  /* ignore */
}
