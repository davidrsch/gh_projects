import * as vscode from 'vscode';
import { ProjectEntry } from '../treeViewProvider';
import ghClient from '../github/ghClient';
import { overviewFetcher as overviewFetcherStr } from './fetchers/overviewFetcher';
import { tableViewFetcher as tableViewFetcherStr } from './fetchers/tableViewFetcher';
import { boardViewFetcher as boardViewFetcherStr } from './fetchers/boardViewFetcher';
import { roadmapViewFetcher as roadmapViewFetcherStr } from './fetchers/roadmapViewFetcher';
import { contentFetcher as contentFetcherStr } from './fetchers/contentFetcher';

const panels = new Map<string, vscode.WebviewPanel>();

export function openProjectWebview(context: vscode.ExtensionContext, project: ProjectEntry) {
  const id = project.id ?? project.url ?? project.title ?? '<unknown>';

  const existing = panels.get(id);
  if (existing) {
    existing.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'ghProjects.projectDetails',
    project.title ?? String(id),
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panels.set(id, panel);
  panel.onDidDispose(() => panels.delete(id), null, context.subscriptions);

  const elementsUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'vscode-elements.js')
  );
  panel.webview.html = buildHtml(panel.webview, project, elementsUri.toString());

  panel.webview.onDidReceiveMessage(
    async msg => {
      if (msg?.command === 'openRepo' && msg.path) {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(msg.path), {
          forceNewWindow: false,
        });
      }
      if (msg?.command === 'openUrl' && msg.url) {
        try{
          const u = vscode.Uri.parse(String(msg.url));
          await vscode.env.openExternal(u);
        }catch(e){ console.error('openUrl failed', e); }
      }
      if (msg?.command === 'requestFields') {
        try {
          const snapshot = await ghClient.fetchProjectFields(project.id as string, { first: 30 });
          panel.webview.postMessage({ command: 'fields', payload: snapshot });
        } catch (e) {
          panel.webview.postMessage({ command: 'fields', error: String(e) });
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

function buildHtml(webview: vscode.Webview, project: ProjectEntry, elementsScriptUri?: string): string {
  const nonce = getNonce();
  const csp = webview.cspSource;

  const projectData = {
    title: project.title,
    repos: project.repos ?? [],
    views: Array.isArray(project.views) ? project.views : [],
    description: project.description ?? '',
  };

  const scriptTag = elementsScriptUri
    ? `<script nonce="${nonce}" type="module" src="${elementsScriptUri}"></script>`
    : '';

  const fetchersScript = [
    overviewFetcherStr,
    tableViewFetcherStr,
    boardViewFetcherStr,
    roadmapViewFetcherStr,
    contentFetcherStr
  ].join('\n\n');

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

${scriptTag}
</head>
<body>
<div id="root">
  <div id="tabs-container"></div>
  <div id="tab-panels"></div>
</div>

<script nonce="${nonce}" type="module">
const vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
const project = ${JSON.stringify(projectData)};
// Temporary debug: print views to the webview console to verify layout values
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
  }

  ${fetchersScript}

  // Initialize first tab
  showTab('overview', tabsContainer.children[0]);

  // Render overview into its panel
  const ov = panelsMap['overview'];
  if(ov){
    // overviewFetcher is provided by the injected fetchers
    if(typeof overviewFetcher === 'function') overviewFetcher(ov);
  }

  // Render each configured view via the contentFetcher (injected)
  (project.views ?? []).forEach((v,i) => {
    const p = panelsMap['view-'+i];
    if(p && typeof contentFetcher === 'function') contentFetcher(v, p);
  });

  panelsContainer.addEventListener('click', e=>{
    const item = e.target?.closest('.repo-item');
    if(item && vscodeApi) vscodeApi.postMessage({command:'openRepo', path:item.dataset.path});
  });

  tabsContainer.addEventListener('wheel', e=>{
    e.preventDefault();
    tabsContainer.scrollBy({ left: e.deltaY, behavior:'smooth' });
  });
});
</script>
</body>
</html>`;
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for(let i=0;i<16;i++) text += possible.charAt(Math.floor(Math.random()*possible.length));
  return text;
}

export default { openProjectWebview };
