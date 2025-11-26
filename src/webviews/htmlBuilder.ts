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
    .concat((project.views ?? []).map((v,i) => ({key:'view-'+i, label:v.name ?? v.id ?? ('View '+(i+1))})));

  const panelsMap = {};

  allTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.textContent = tab.label;
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
});
</script>
</body>
</html>`;
}
