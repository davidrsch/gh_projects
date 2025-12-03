import * as vscode from "vscode";
import { ProjectEntry } from "../lib/types";

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function buildHtml(
  webview: vscode.Webview,
  project: ProjectEntry,
  elementsScriptUri?: string,
  fetcherUris?: {
    overviewUri: vscode.Uri;
    tableUri: vscode.Uri;
    boardUri: vscode.Uri;
    roadmapUri: vscode.Uri;
    contentUri: vscode.Uri;
    patchUri?: vscode.Uri;
    helperUri?: vscode.Uri;
  },
  panelKey?: string,
  vscodeShimUri?: string
): string {
  const nonce = getNonce();
  const csp = webview.cspSource;

  const projectData = {
    title: project.title,
    repos: project.repos ?? [],
    views: Array.isArray(project.views) ? project.views : [],
    description: project.description ?? "",
    panelKey: panelKey ?? "<no-panel-key>",
  };

  const scriptTag = elementsScriptUri
    ? `<script nonce="${nonce}" src="${elementsScriptUri}"></script>`
    : "";

  // loader script tags for static fetcher files
  // Use classic scripts (no type="module") so they execute synchronously
  const fetcherScripts = fetcherUris
    ? [
      ...(vscodeShimUri
        ? [`<script nonce="${nonce}" src="${vscodeShimUri}"></script>`]
        : []),
      ...(fetcherUris.helperUri
        ? [
          `<script nonce="${nonce}" src="${fetcherUris.helperUri.toString()}"></script>`,
        ]
        : []),
      `<script nonce="${nonce}" src="${fetcherUris.overviewUri.toString()}"></script>`,
      `<script nonce="${nonce}" src="${fetcherUris.tableUri.toString()}"></script>`,
      `<script nonce="${nonce}" src="${fetcherUris.boardUri.toString()}"></script>`,
      `<script nonce="${nonce}" src="${fetcherUris.roadmapUri.toString()}"></script>`,
      `<script nonce="${nonce}" src="${fetcherUris.contentUri.toString()}"></script>`,
      ...(fetcherUris.patchUri
        ? [
          `<script nonce="${nonce}" src="${fetcherUris.patchUri.toString()}"></script>`,
        ]
        : []),
    ].join("\n")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${csp} https: data:; style-src ${csp} 'unsafe-inline' https:; script-src 'nonce-${nonce}' ${csp} https:;">
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${projectData.title}</title>

<style>
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  font-family: var(--vscode-font-family);
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}

#root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Scrollable tabs container */
#tabs-container {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  border-bottom: 1px solid var(--vscode-editorWidget-border);

  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background) var(--vscode-scrollbar-background);
}

/* Chromium / WebKit */
#tabs-container::-webkit-scrollbar {
  height: 8px;
}
#tabs-container::-webkit-scrollbar-track {
  background: var(--vscode-scrollbar-background);
}
#tabs-container::-webkit-scrollbar-thumb {
  background-color: var(--vscode-scrollbarSlider-background);
  border-radius: 0px; /* square thumb */
}
#tabs-container::-webkit-scrollbar-button {
  display: none; /* hide arrows */
  width: 0;
  height: 0;
}

/* Tab headers size similar to VS Code default */
.tab {
  display: inline-block;
  padding: 10px 16px; /* VS Code default size */
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.tab .tab-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  vertical-align: -2px;
  margin-right: 8px;
}

.tab:hover {
  background: var(--vscode-list-hoverBackground);
  color: var(--vscode-list-hoverForeground);
}

.tab.active {
  font-weight: 600;
  border-bottom: 2px solid var(--vscode-focusBorder);
  color: var(--vscode-list-activeSelectionForeground);
}

#tab-panels {
  flex: 1;
  overflow: auto;
  padding: 12px;
  box-sizing: border-box;
}

.repo-list { display: flex; flex-wrap: wrap; gap: 8px; }
.repo-item { padding: 6px 8px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; cursor: pointer; }
.repo-item:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-list-hoverForeground); }
.title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
</style>

${vscodeShimUri ? `<script nonce="${nonce}" src="${vscodeShimUri}"></script>` : ''}
${scriptTag}
</head>
<body>
<div id="root">
  <div id="tabs-container"></div>
  <div id="tab-panels"></div>
</div>
<script nonce="${nonce}">
  // Expose initial project data for the static web UI to consume via postMessage/init
  window.__project_data__ = ${JSON.stringify(projectData)};
</script>

${fetcherScripts}

<script nonce="${nonce}" type="module">
  // Module bootstrap for legacy webviews when running as the fallback.
  const project = ${JSON.stringify(projectData)};
  console.log('project.views', project.views);

  document.addEventListener('DOMContentLoaded', () => {
  const tabsContainer = document.getElementById('tabs-container');
  const panelsContainer = document.getElementById('tab-panels');

  const allTabs = [{key:'overview', label:'Overview'}]
    .concat((project.views ?? []).map((v,i) => ({
      key: 'view-'+i,
      label: v.name ?? v.id ?? ('View '+(i+1)),
      layout: (v.layout || 'table')
    })));

  const panelsMap = {};

  allTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    // Add icon depending on view layout (only for view tabs)
    if (tab.key && String(tab.key).startsWith('view-')) {
      const layout = tab.layout || 'table';
      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'tab-icon';

      // Inline lightweight SVGs approximating octicons so they render without external deps
      if (layout === 'table') {
        // octicon-table (official path)
        iconWrapper.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path xmlns="http://www.w3.org/2000/svg" d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"/></path></svg>';
      } else if (layout === 'board' || layout === 'project') {
        // octicon-project (official path)
        iconWrapper.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25ZM11.75 3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm-8.25.75a.75.75 0 0 1 1.5 0v5.5a.75.75 0 0 1-1.5 0ZM8 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 3Z"></path></svg>';
      } else if (layout === 'roadmap') {
        // octicon-project-roadmap (official path)
        iconWrapper.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M4.75 7a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM5 4.75A.75.75 0 0 1 5.75 4h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 5 4.75ZM6.75 10a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z"></path><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Z"></path></svg>';
      } else {
        iconWrapper.innerHTML = '';
      }

      tabEl.appendChild(iconWrapper);
    }
    const labelNode = document.createTextNode(tab.label);
    tabEl.appendChild(labelNode);
    tabsContainer.appendChild(tabEl);

    const panel = document.createElement('div');
    panel.style.display = 'none';

    panelsContainer.appendChild(panel);
    panelsMap[tab.key] = panel;

    tabEl.addEventListener('click', () => showTab(tab.key, tabEl));
  });

  function showTab(key, tabEl) {
    Object.values(panelsMap).forEach(p => p.style.display = 'none');
    if (panelsMap[key]) panelsMap[key].style.display = 'block';

    Array.from(tabsContainer.children).forEach(el => el.classList.toggle('active', el === tabEl));

    // Scroll active tab into view
    if(tabEl){
      const contRect = tabsContainer.getBoundingClientRect();
      const elRect = tabEl.getBoundingClientRect();
      if(elRect.left < contRect.left){
        tabsContainer.scrollBy({ left: elRect.left - contRect.left - 8, behavior:'smooth' });
      } else if(elRect.right > contRect.right){
        tabsContainer.scrollBy({ left: elRect.right - contRect.right + 8, behavior:'smooth' });
      }
    }

    // Trigger fetchers for this tab
    if (key === 'overview') {
      if(window.overviewFetcher) window.overviewFetcher(project, panelsMap[key]);
    } else if (key.startsWith('view-')) {
      const idx = parseInt(key.split('-')[1]);
      const view = project.views[idx];
      if (view) {
        // Decide which fetcher to use based on view layout
        // For now, default to table view unless it's a board
        const layout = view.layout || 'table';
        if (layout === 'board') {
           if (window.boardViewFetcher) {
             window.boardViewFetcher(view, panelsMap[key], key);
           } else {
             panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground)">Board fetcher not loaded.</div>';
           }
        } else if (layout === 'roadmap') {
           if (window.roadmapViewFetcher) {
             window.roadmapViewFetcher(view, panelsMap[key], key);
           } else {
             panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground)">Roadmap fetcher not loaded.</div>';
           }
        } else if (layout === 'table') {
           if (window.tableViewFetcher) {
             window.tableViewFetcher(view, panelsMap[key], key);
           } else {
             panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground)">Table fetcher not loaded.</div>';
           }
        } else {
           panelsMap[key].innerHTML = '<div style="padding:20px;color:var(--vscode-errorForeground)">Unsupported layout: ' + layout + '</div>';
        }
      }
    }
  }

  // Select first tab by default
  if (allTabs.length > 0) {
    showTab(allTabs[0].key, tabsContainer.children[0]);
  }

  // Test infrastructure for integration tests
  (function() {
      let vscode = undefined;
      
      try {
          vscode = acquireVsCodeApi();
          window.vscodeApi = vscode;
      } catch (e) {
          if (window.vscodeApi) {
              vscode = window.vscodeApi;
          } else if (window.__APP_MESSAGING__) {
              // Wrap it to look like vscode api
              vscode = {
                  postMessage: (msg) => window.__APP_MESSAGING__.postMessage(msg)
              };
          }
      }

      if (vscode) {
          // Send ready message
          vscode.postMessage({ command: 'test:ready', from: 'test-infra' });
          
          window.addEventListener('message', (event) => {
              const msg = event.data;
              if (msg && msg.command && msg.command.startsWith('test:')) {
                  handleTestCommand(msg, vscode);
              }
          });
      }
  })();

  function handleTestCommand(msg, vscode) {
    console.log('[Webview] Handling test command:', msg.command);
    const { command, requestId } = msg;
    
    try {
      let result = null;

      switch (command) {
        case 'test:getProjectInfo':
          result = {
            projectTitle: project.title,
            totalViews: project.views?.length || 0,
            viewNames: (project.views || []).map(v => v.name || v.id),
            views: (project.views || []).map((v, i) => ({ 
                index: i, 
                name: v.name || v.id, 
                layout: v.layout || 'table' 
            }))
          };
          break;
// ... rest of the function ...

        case 'test:clickTab':
          const tabIndex = msg.tabIndex;
          const tabs = tabsContainer.querySelectorAll('.tab');
          if (tabs[tabIndex]) {
            tabs[tabIndex].click();
            result = { success: true, tabIndex };
          } else {
            result = { success: false, error: 'Tab not found', tabIndex };
          }
          break;

        case 'test:getTableInfo':
          // Find visible panel
          const visiblePanel = Array.from(panelsContainer.children).find(p => p.style.display !== 'none');
          if (!visiblePanel) {
             result = { hasContainer: false, rowCount: 0, sliceItemCount: 0, error: 'No visible panel' };
          } else {
             const rows = visiblePanel.querySelectorAll('[data-gh-item-id]');
             const sliceItems = visiblePanel.querySelectorAll('.slice-value-item');
             // Consider it a table view if it has rows (table items)
             result = {
                hasContainer: rows.length > 0,
                rowCount: rows.length,
                sliceItemCount: sliceItems.length,
                firstRowId: rows.length > 0 ? rows[0].getAttribute('data-gh-item-id') : null
             };
          }
          break;

        case 'test:clickRow':
          const rowIndex = msg.rowIndex || 0;
          const tableRows = panelsContainer.querySelectorAll('[data-gh-item-id]');
          if (tableRows[rowIndex]) {
            tableRows[rowIndex].click();
            result = { success: true, rowIndex, itemId: tableRows[rowIndex].getAttribute('data-gh-item-id') };
          } else {
            result = { success: false, error: 'Row not found', rowIndex };
          }
          break;

        case 'test:getStyles':
          const selector = msg.selector;
          const element = panelsContainer.querySelector(selector);
          if (element) {
            const styles = window.getComputedStyle(element);
            result = {
              success: true,
              color: styles.color,
              backgroundColor: styles.backgroundColor,
              fontSize: styles.fontSize,
              display: styles.display
            };
          } else {
            result = { success: false, error: 'Element not found' };
          }
          break;

        default:
          result = { error: 'Unknown test command: ' + command };
      }

      // Send result back
      vscode.postMessage({
          command: 'test:result',
          requestId,
          result
      });
    } catch (error) {
      // Send error back
      vscode.postMessage({
          command: 'test:result',
          requestId,
          error: error.message || String(error)
      });
    }
  }
});
</script>
</body>
</html>`;
}
