// App entry for web UI. Uses window.__APP_MESSAGING__ for transport.
function ensureMessaging() {
  if (window.__APP_MESSAGING__) return;
  // Fallback no-op messaging so the app can run in a plain browser
  const listeners = [];
  window.__APP_MESSAGING__ = {
    postMessage(msg) {
      // no-op in browser shim
    },
    onMessage(handler) {
      if (typeof handler === 'function') listeners.push(handler);
    }
  };
  // Forward window messages to handlers (useful for some dev flows)
  window.addEventListener('message', (ev) => {
    try { listeners.forEach(h => h(ev.data)); } catch (e) { /* ignore */ }
  });
}

ensureMessaging();

let project = null;
let resources = {};
let panelKey = null;
let _lastInitSignature = null;
// diagnostics removed

// Signal host that the UI is ready to receive init payloads. Extension should respond by posting an 'init' message.
try {
  if (window.__APP_MESSAGING__ && typeof window.__APP_MESSAGING__.postMessage === 'function') {
    window.__APP_MESSAGING__.postMessage({ command: 'ready' });
  }
} catch (e) { }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-webui-src', String(src));
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('load error ' + String(src)));
    document.head.appendChild(s);
  });
}

function renderUI() {
  const tabsContainer = document.getElementById('tabs-container');
  const panelsContainer = document.getElementById('tab-panels');
  tabsContainer.innerHTML = '';
  panelsContainer.innerHTML = '';

  const allTabs = [{key:'overview', label:'Overview'}].concat((project.views||[]).map((v,i)=>({key:'view-'+i, label: v.name||v.id||('View '+(i+1))}))); 
  const panelsMap = {};

  allTabs.forEach((tab, idx)=>{
    const tabEl = document.createElement('div'); tabEl.className='tab'; tabEl.textContent=tab.label; tabsContainer.appendChild(tabEl);
    const panel = document.createElement('div'); panel.style.display='none'; panelsContainer.appendChild(panel); panelsMap[tab.key]=panel;
    tabEl.addEventListener('click', ()=> showTab(tab.key, tabEl));
  });

  async function showTab(key, tabEl) {
    Object.values(panelsMap).forEach(p=>p.style.display='none');
    if (panelsMap[key]) panelsMap[key].style.display='block';
    Array.from(tabsContainer.children).forEach(el=> el.classList.toggle('active', el===tabEl));
    if (key==='overview') {
      if (window.overviewFetcher) window.overviewFetcher(project, panelsMap[key]);
    } else if (key.startsWith('view-')) {
      const idx = parseInt(key.split('-')[1]); const view = project.views[idx];
      const layout = (view && view.layout) || 'table';
      if (layout==='board') {
        if (window.boardViewFetcher) window.boardViewFetcher(view, panelsMap[key], key);
        else panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-descriptionForeground, #900)">Board fetcher not loaded.</div>';
      } else if (layout==='roadmap') {
        if (window.roadmapViewFetcher) window.roadmapViewFetcher(view, panelsMap[key], key);
        else panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-descriptionForeground, #900)">Roadmap fetcher not loaded.</div>';
      } else {
        if (window.tableViewFetcher) window.tableViewFetcher(view, panelsMap[key], key);
        else panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-descriptionForeground, #900)">Table fetcher not loaded.</div>';
      }
    }
  }

  if (allTabs.length>0) showTab(allTabs[0].key, tabsContainer.children[0]);
}
// Listen for messages (including 'init')
window.__APP_MESSAGING__.onMessage(async (msg) => {
  try {
    if (!msg || typeof msg !== 'object') return;
    if (msg.command === 'init') {
      project = msg.project || null;
      resources = msg.resources || {};
      panelKey = msg.panelKey || null;

      // Avoid duplicate inits: simple signature check
      try {
        const sigObj = { panelKey: panelKey || null, resources: Object.values(resources).filter(Boolean) };
        const sig = JSON.stringify(sigObj);
        if (_lastInitSignature && _lastInitSignature === sig) return;
        _lastInitSignature = sig;
      } catch (e) { /* ignore */ }

      // Dynamically load fetcher scripts if provided
      const toLoad = [];
      ['helper','overview','table','board','roadmap','content','patch','elements'].forEach(k => {
        if (resources[k]) toLoad.push(resources[k].toString());
      });
      try {
        if (!toLoad || toLoad.length === 0) {
          const panelNotice = document.createElement('div');
          panelNotice.style.padding = '16px';
          panelNotice.style.color = 'var(--vscode-descriptionForeground, #900)';
          panelNotice.textContent = 'No fetcher scripts were provided by the host. Views may not load.';
          const panelsContainer = document.getElementById('tab-panels');
          if (panelsContainer) panelsContainer.appendChild(panelNotice);
        }
        for (const s of toLoad) {
          try { await loadScript(s); } catch (err) {
            const panelsContainer = document.getElementById('tab-panels');
            const errEl = document.createElement('div');
            errEl.style.padding = '12px';
            errEl.style.color = 'var(--vscode-descriptionForeground, #900)';
            errEl.textContent = 'Some fetcher scripts failed to load; check the webview console for details.';
            if (panelsContainer) panelsContainer.appendChild(errEl);
            break;
          }
        }
      } catch (e) { /* ignore */ }
      renderUI();
    } else if (msg.command === 'fields') {
      // Pass through to any fetchers or UI that needs fields updates
      if (window.onFieldsMessage) window.onFieldsMessage(msg);
    } else if (msg.command === 'refresh') {
      // refresh currently visible tab by re-rendering
      renderUI();
    }
  } catch (e) { /* ignore */ }
});

// Helper to send messages to extension/host
export function postToHost(message) {
  if (window.__APP_MESSAGING__) window.__APP_MESSAGING__.postMessage(message);
}
