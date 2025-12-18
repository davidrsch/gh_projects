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

export function getCspMetaTag(nonce: string, cspSource: string): string {
  return `<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline' https:; script-src 'nonce-${nonce}' 'unsafe-eval' ${cspSource} https:;">`;
}

export function getStyles(): string {
  return `
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

/* Editable cell styles */
td[data-editable="true"] {
  position: relative;
  cursor: pointer;
}

td[data-editable="true"]:hover {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: -1px;
}

td[data-editable="true"]:focus {
  outline: 2px solid var(--vscode-focusBorder);
  outline-offset: -2px;
}

/* Editing state */
td.editing {
  padding: 0 !important;
  background: var(--vscode-input-background);
}

td.loading {
  opacity: 0.6;
  pointer-events: none;
}

td.error {
  outline: 2px solid var(--vscode-inputValidation-errorBorder);
}

/* Cell editor input styles */
.cell-editor-input {
  width: 100%;
  height: 100%;
  border: 1px solid var(--vscode-focusBorder);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  padding: 4px 8px;
  font-size: 13px;
  font-family: var(--vscode-font-family);
  outline: none;
  box-sizing: border-box;
}

.cell-editor-input:focus {
  border-color: var(--vscode-focusBorder);
}

/* Date editor specific styles */
.cell-editor-date {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
}

.cell-editor-clear {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 1px solid var(--vscode-button-border);
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border-radius: 3px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-editor-clear:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

/* Error tooltip */
.cell-editor-error {
  position: absolute;
  top: 100%;
  left: 0;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  color: var(--vscode-inputValidation-errorForeground);
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  z-index: 1000;
  white-space: nowrap;
  margin-top: 2px;
}
</style>`;
}

export function getScriptTags(
  nonce: string,
  fetcherUris?: {
    overviewUri: vscode.Uri;
    tableUri: vscode.Uri;
    boardUri: vscode.Uri;
    roadmapUri: vscode.Uri;
    contentUri: vscode.Uri;
    patchUri?: vscode.Uri;
    helperUri?: vscode.Uri;
    iconHelperUri?: vscode.Uri;
  },
  vscodeShimUri?: string,
  elementsScriptUri?: string,
): string {
  const scripts: string[] = [];

  if (vscodeShimUri) {
    scripts.push(`<script nonce="${nonce}" src="${vscodeShimUri}"></script>`);
  }

  if (elementsScriptUri) {
    scripts.push(
      `<script nonce="${nonce}" src="${elementsScriptUri}"></script>`,
    );
  }

  if (fetcherUris) {
    // Icon helper must be loaded first so other scripts can use icon functions
    if (fetcherUris.iconHelperUri) {
      scripts.push(
        `<script nonce="${nonce}" src="${fetcherUris.iconHelperUri.toString()}"></script>`,
      );
    }
    if (fetcherUris.helperUri) {
      scripts.push(
        `<script nonce="${nonce}" src="${fetcherUris.helperUri.toString()}"></script>`,
      );
    }
    scripts.push(
      `<script nonce="${nonce}" src="${fetcherUris.overviewUri.toString()}"></script>`,
    );
    scripts.push(
      `<script nonce="${nonce}" src="${fetcherUris.tableUri.toString()}"></script>`,
    );
    scripts.push(
      `<script nonce="${nonce}" src="${fetcherUris.boardUri.toString()}"></script>`,
    );
    scripts.push(
      `<script nonce="${nonce}" src="${fetcherUris.roadmapUri.toString()}"></script>`,
    );
    scripts.push(
      `<script nonce="${nonce}" src="${fetcherUris.contentUri.toString()}"></script>`,
    );
    if (fetcherUris.patchUri) {
      scripts.push(
        `<script nonce="${nonce}" src="${fetcherUris.patchUri.toString()}"></script>`,
      );
    }
  }

  return scripts.join("\n");
}

export function getInlineScript(nonce: string, projectData: any): string {
  return `
<script nonce="${nonce}">
  // Expose initial project data for the static web UI to consume via postMessage/init
  window.__project_data__ = ${JSON.stringify(projectData)};
</script>
<script nonce="${nonce}" type="module">
  // Module bootstrap for legacy webviews when running as the fallback.
  const project = ${JSON.stringify(projectData)};
  window.__PROJECT_DATA__ = project; // Expose globally for tests
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

        // Use icon registry for consistent GitHub-style icons
        let iconName = null;
        if (layout === 'table') {
          iconName = 'table';
        } else if (layout === 'board' || layout === 'project') {
          iconName = 'project';
        } else if (layout === 'roadmap') {
          iconName = 'roadmap';
        }

        if (iconName && window.getIconSvg) {
          iconWrapper.innerHTML = window.getIconSvg(iconName);
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
            }
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message && message.command === 'init' && message.project) {
              window.__PROJECT_DATA__ = message.project;
            }
            if (message.command && message.command.startsWith('test:')) {
                if (window.handleTestCommand) {
                    window.handleTestCommand(message, vscode);
                }
            }
        });
    })();
  });
</script>`;
}

export function getTestHandlerScript(
  nonce: string,
  testHandlerCode: string,
): string {
  return `
<script nonce="${nonce}">
${testHandlerCode}
</script>`;
}
