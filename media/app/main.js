// Webview app entry point: handles selection, messaging, and dispatch to layout renderers
import { renderTable } from './tables.js';

(function(){
  const vscode = acquireVsCodeApi();
  const state = (window.WEBVIEW_STATE || {});
  const views = Array.isArray(state.views) ? state.views : [];
  const loadedViews = new Set();

  const tabs = document.getElementById('tabs');

  function findViewContainer(viewNumber){
    return document.getElementById('view-' + String(viewNumber));
  }

  function showLoading(el){
    if (!el) return;
    el.innerHTML = '<div style="padding:8px"><vscode-progress-ring></vscode-progress-ring> Loading…</div>';
  }

  function showMessage(el, msg){
    if (!el) return;
    el.innerHTML = '<div class="meta">' + String(msg ?? '') + '</div>';
  }

  function requestLoad(viewNumber){
    const el = findViewContainer(viewNumber);
    if (!el) return;
    if (!loadedViews.has(viewNumber)) {
      loadedViews.add(viewNumber);
    }
    showLoading(el);
    vscode.postMessage({ type: 'loadView', viewNumber });
  }

  function handleSelection(){
    setTimeout(() => {
      const idx = (tabs && 'selectedIndex' in tabs) ? (tabs.selectedIndex || 0) : 0;
      if (idx <= 0) return; // overview selected
      const v = views[idx - 1];
      if (!v) return;
      if (!loadedViews.has(v.number)) {
        requestLoad(v.number);
      }
      // Keep selected tab visible in header
      ensureSelectedTabVisible(idx);
    }, 0);
  }

  if (tabs) {
    tabs.addEventListener('vsc-tabs-select', handleSelection);
    tabs.addEventListener('vsc-change', handleSelection);
    tabs.addEventListener('change', handleSelection);
  }

  function wireHeaderClicks(){
    const headers = Array.from(document.querySelectorAll('vscode-tab-header[slot="header"]'));
    headers.forEach((h, idx) => {
      h.addEventListener('click', () => {
        if (idx === 0) return; // Overview
        const v = views[idx - 1];
        if (!v) return;
        if (!loadedViews.has(v.number)) {
          requestLoad(v.number);
        }
        ensureSelectedTabVisible(idx);
      }, { passive: true });
    });
  }
  wireHeaderClicks();

  function ensureSelectedTabVisible(idx){
    // Attempt to scroll the selected tab into view inside the header
    const headers = Array.from(document.querySelectorAll('vscode-tab-header[slot="header"]'));
    const headerEl = headers[idx];
    if (!headerEl) return;
    const tabsEl = document.querySelector('vscode-tabs');
    // Scroll the light DOM header element; the host handles projection
    headerEl.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    if (tabsEl && tabsEl.shadowRoot) {
      const shHeader = tabsEl.shadowRoot.querySelector('[part="header"], .header, [role="tablist"]');
      if (shHeader && typeof shHeader.scrollLeft === 'number') {
        // no-op: browser will adjust from scrollIntoView
      }
    }
  }

  window.addEventListener('message', (event) => {
    const { type, payload } = event.data || {};
    if (type === 'viewData') {
      const { viewNumber, layout, meta, items } = payload || {};
      const el = findViewContainer(viewNumber);
      if (!el) return;
      switch (layout) {
        case 'TABLE':
          renderTable(el, meta, items);
          break;
        case 'BOARD':
        case 'CALENDAR':
        case 'ROADMAP':
        default:
          showMessage(el, `${layout || 'View'} layout is not implemented yet.`);
      }
    } else if (type === 'error') {
      const { viewNumber, message } = payload || {};
      const el = findViewContainer(viewNumber);
      if (el) showMessage(el, message || 'Error');
    }
  });

  // Fallback: if ::part(header) styling isn't applied, set minimal overflow styles
  function applyScrollableHeader(){
    if (!tabs || !tabs.shadowRoot) return false;
    const header = tabs.shadowRoot.querySelector('[part="header"], .header, [role="tablist"]');
    if (!header) return false;
    header.style.display = 'flex';
    header.style.overflowX = 'auto';
    header.style.overflowY = 'hidden';
    header.style.whiteSpace = 'nowrap';
    return true;
  }

  if (tabs) {
    const tryApply = () => {
      if (!applyScrollableHeader()) setTimeout(tryApply, 200);
    };
    if (customElements && customElements.whenDefined) {
      customElements.whenDefined('vscode-tabs').then(() => tryApply());
    } else {
      tryApply();
    }
  }
})();
