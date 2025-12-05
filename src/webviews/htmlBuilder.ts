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
      content="default-src 'none'; img-src ${csp} https: data:; style-src ${csp} 'unsafe-inline' https:; script-src 'nonce-${nonce}' 'unsafe-eval' ${csp} https:;">
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
    
    // Helper: get visible panel
    function getVisiblePanel() {
      return Array.from(panelsContainer.children).find(p => {
        const style = window.getComputedStyle(p);
        return style.display !== 'none';
      });
    }
    
    // Helper: get computed styles for element
    function getStyles(el, props) {
      if (!el) return null;
      const computed = window.getComputedStyle(el);
      const result = {};
      props.forEach(p => result[p] = computed[p]);
      return result;
    }
    
    // Helper: simulate mouse event
    function simulateEvent(el, eventType, options = {}) {
      if (!el) return false;
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...options
      });
      el.dispatchEvent(event);
      return true;
    }
    
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

        case 'test:getTabBar': {
          const tabs = tabsContainer.querySelectorAll('.tab');
          const tabData = Array.from(tabs).map((tab, i) => {
            const icon = tab.querySelector('.tab-icon svg');
            const isActive = tab.classList.contains('active');
            const styles = getStyles(tab, ['padding', 'cursor', 'fontWeight', 'borderBottom', 'color', 'background']);
            return {
              index: i,
              text: tab.textContent?.trim(),
              isActive,
              hasIcon: !!icon,
              iconClass: icon?.classList?.[1] || null,
              styles
            };
          });
          result = {
            count: tabs.length,
            tabs: tabData,
            containerStyles: getStyles(tabsContainer, ['overflowX', 'overflowY', 'borderBottom'])
          };
          break;
        }

        case 'test:clickTab': {
          const tabIndex = msg.tabIndex;
          const tabs = tabsContainer.querySelectorAll('.tab');
          if (tabs[tabIndex]) {
            simulateEvent(tabs[tabIndex], 'click');
            result = { success: true, tabIndex };
          } else {
            result = { success: false, error: 'Tab not found', tabIndex };
          }
          break;
        }
        
        case 'test:hoverTab': {
          const tabIndex = msg.tabIndex;
          const tabs = tabsContainer.querySelectorAll('.tab');
          if (tabs[tabIndex]) {
            simulateEvent(tabs[tabIndex], 'mouseenter');
            // Get styles after hover
            const styles = getStyles(tabs[tabIndex], ['background', 'color']);
            result = { success: true, styles };
          } else {
            result = { success: false, error: 'Tab not found' };
          }
          break;
        }

        case 'test:getTableInfo': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { hasContainer: false, rowCount: 0, error: 'No visible panel' };
          } else {
            const tableWrapper = visiblePanel.querySelector('.table-wrapper');
            const table = visiblePanel.querySelector('table');
            const rows = visiblePanel.querySelectorAll('tbody tr[data-gh-item-id]');
            const sliceItems = visiblePanel.querySelectorAll('.slice-value-item');
            const groupHeaders = visiblePanel.querySelectorAll('.group-header');
            result = {
              hasContainer: !!tableWrapper,
              hasTable: !!table,
              rowCount: rows.length,
              sliceItemCount: sliceItems.length,
              groupHeaderCount: groupHeaders.length,
              firstRowId: rows.length > 0 ? rows[0].getAttribute('data-gh-item-id') : null
            };
          }
          break;
        }

        case 'test:getHeaders': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const headers = visiblePanel.querySelectorAll('thead th');
            const headerData = Array.from(headers).map((th, i) => {
              const text = th.textContent?.trim() || '';
              const menuBtn = th.querySelector('button');
              const sortIndicator = text.includes('↑') ? 'ASC' : text.includes('↓') ? 'DESC' : null;
              const groupIcon = th.querySelector('.column-group-icon');
              const sliceIcon = th.querySelector('.column-slice-icon');
              const styles = getStyles(th, ['position', 'top', 'zIndex', 'background', 'padding', 'borderRight', 'borderBottom', 'whiteSpace', 'height']);
              return {
                index: i,
                text,
                hasMenu: !!menuBtn,
                sortDirection: sortIndicator,
                isGrouped: !!groupIcon,
                isSliced: !!sliceIcon,
                styles
              };
            });
            result = { count: headers.length, headers: headerData };
          }
          break;
        }

        case 'test:clickHeaderMenu': {
          const headerIndex = msg.headerIndex;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const headers = visiblePanel.querySelectorAll('thead th');
            const th = headers[headerIndex];
            if (!th) {
              result = { error: 'Header not found' };
            } else {
              const menuBtn = th.querySelector('button');
              if (!menuBtn) {
                result = { error: 'No menu button on header' };
              } else {
                simulateEvent(menuBtn, 'click');
                result = { success: true };
              }
            }
          }
          break;
        }

        case 'test:getMenu': {
          const menu = document.querySelector('.column-header-menu');
          if (!menu) {
            result = { open: false, items: [] };
          } else {
            const items = menu.querySelectorAll('.menu-item');
            const itemData = Array.from(items).map(item => {
              const icon = item.querySelector('svg');
              const clearBtn = item.querySelector('.menu-item-clear');
              const isDisabled = item.classList.contains('disabled') || item.style.opacity < 0.8;
              return {
                text: item.textContent?.trim(),
                hasIcon: !!icon,
                iconClass: icon?.classList?.[1] || null,
                hasClear: !!clearBtn,
                isDisabled
              };
            });
            const styles = getStyles(menu, ['background', 'border', 'borderRadius', 'boxShadow', 'minWidth']);
            result = { open: true, items: itemData, styles };
          }
          break;
        }

        case 'test:clickMenuItem': {
          const text = msg.text;
          const menu = document.querySelector('.column-header-menu');
          if (!menu) {
            result = { error: 'Menu not open' };
          } else {
            const items = menu.querySelectorAll('.menu-item');
            let found = false;
            for (const item of items) {
              if (item.textContent?.includes(text)) {
                simulateEvent(item, 'click');
                found = true;
                break;
              }
            }
            result = { success: found, error: found ? null : 'Item not found: ' + text };
          }
          break;
        }

        case 'test:getCellContent': {
          const rowIndex = msg.rowIndex || 0;
          const colIndex = msg.colIndex || 0;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const rows = visiblePanel.querySelectorAll('tbody tr[data-gh-item-id]');
            const row = rows[rowIndex];
            if (!row) {
              result = { error: 'Row not found' };
            } else {
              const cells = row.querySelectorAll('td');
              const cell = cells[colIndex];
              if (!cell) {
                result = { error: 'Cell not found' };
              } else {
                // Analyze cell content
                const link = cell.querySelector('a');
                const pills = cell.querySelectorAll('span[style*="border-radius: 999px"], span[style*="border-radius:999px"]');
                const avatars = cell.querySelectorAll('span[style*="border-radius: 50%"], span[style*="border-radius:50%"]');
                const progressBar = cell.querySelector('.sub-issues-progress');
                const svg = cell.querySelector('svg');
                
                result = {
                  html: cell.innerHTML,
                  text: cell.textContent?.trim(),
                  hasLink: !!link,
                  linkHref: link?.href || null,
                  pillCount: pills.length,
                  avatarCount: avatars.length,
                  hasProgressBar: !!progressBar,
                  hasSvg: !!svg,
                  styles: getStyles(cell, ['textAlign', 'padding', 'overflow'])
                };
              }
            }
          }
          break;
        }

        case 'test:getSlicePanel': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const slicePanel = visiblePanel.querySelector('.slice-panel');
            if (!slicePanel) {
              result = { open: false };
            } else {
              const values = slicePanel.querySelectorAll('.slice-value-item');
              const valueData = Array.from(values).map(v => ({
                text: v.textContent?.trim(),
                isSelected: v.classList.contains('selected') || v.style.background?.includes('selection')
              }));
              result = {
                open: true,
                valueCount: values.length,
                values: valueData,
                styles: getStyles(slicePanel, ['position', 'background', 'borderRight', 'width'])
              };
            }
          }
          break;
        }

        case 'test:clickSliceValue': {
          const valueIndex = msg.valueIndex || 0;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const values = visiblePanel.querySelectorAll('.slice-value-item');
            if (values[valueIndex]) {
              simulateEvent(values[valueIndex], 'click');
              result = { success: true };
            } else {
              result = { error: 'Value not found' };
            }
          }
          break;
        }

        case 'test:getGroupHeaders': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const groupHeaders = visiblePanel.querySelectorAll('.group-header');
            const groups = Array.from(groupHeaders).map(gh => {
              const text = gh.textContent?.trim();
              const isCollapsed = gh.classList.contains('collapsed') || gh.querySelector('[style*="rotate"]');
              const progressBar = gh.querySelector('.group-progress');
              return { text, isCollapsed: !!isCollapsed, hasProgress: !!progressBar };
            });
            result = { count: groupHeaders.length, groups };
          }
          break;
        }

        case 'test:clickGroupHeader': {
          const groupIndex = msg.groupIndex || 0;
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const groupHeaders = visiblePanel.querySelectorAll('.group-header');
            if (groupHeaders[groupIndex]) {
              simulateEvent(groupHeaders[groupIndex], 'click');
              result = { success: true };
            } else {
              result = { error: 'Group header not found' };
            }
          }
          break;
        }

        case 'test:getFieldsMenu': {
          const fieldsMenu = document.querySelector('.fields-menu');
          if (!fieldsMenu) {
            result = { open: false };
          } else {
            const fields = fieldsMenu.querySelectorAll('.field-item');
            const fieldData = Array.from(fields).map(f => {
              const toggle = f.querySelector('input[type="checkbox"], .toggle');
              const icon = f.querySelector('svg');
              return {
                name: f.textContent?.trim(),
                isVisible: toggle?.checked !== false,
                hasIcon: !!icon
              };
            });
            result = { open: true, fields: fieldData };
          }
          break;
        }

        case 'test:clickAddColumn': {
          const visiblePanel = getVisiblePanel();
          if (!visiblePanel) {
            result = { error: 'No visible panel' };
          } else {
            const addBtn = visiblePanel.querySelector('th:last-child button');
            if (addBtn) {
              simulateEvent(addBtn, 'click');
              result = { success: true };
            } else {
              result = { error: 'Add column button not found' };
            }
          }
          break;
        }

        case 'test:getElementStyles': {
          const selector = msg.selector;
          const props = msg.props || ['color', 'background', 'display'];
          const visiblePanel = getVisiblePanel();
          const root = msg.global ? document : (visiblePanel || document);
          const el = root.querySelector(selector);
          if (!el) {
            result = { error: 'Element not found: ' + selector };
          } else {
            result = { styles: getStyles(el, props) };
          }
          break;
        }

        case 'test:hoverElement': {
          const selector = msg.selector;
          const visiblePanel = getVisiblePanel();
          const root = msg.global ? document : (visiblePanel || document);
          const el = root.querySelector(selector);
          if (!el) {
            result = { error: 'Element not found' };
          } else {
            simulateEvent(el, 'mouseenter');
            simulateEvent(el, 'pointerenter');
            // Wait a tick for CSS transitions
            setTimeout(() => {}, 10);
            const styles = getStyles(el, msg.props || ['background', 'color', 'opacity']);
            result = { success: true, styles };
          }
          break;
        }

        case 'test:clickElement': {
          const selector = msg.selector;
          const visiblePanel = getVisiblePanel();
          const root = msg.global ? document : (visiblePanel || document);
          const el = root.querySelector(selector);
          if (!el) {
            result = { error: 'Element not found: ' + selector };
          } else {
            simulateEvent(el, 'click');
            result = { success: true };
          }
          break;
        }

        case 'test:closeMenu': {
          // Click on backdrop or body to close any open menu
          const backdrop = document.querySelector('.menu-backdrop');
          if (backdrop) {
            simulateEvent(backdrop, 'click');
          } else {
            simulateEvent(document.body, 'click');
          }
          result = { success: true };
          break;
        }

        case 'test:evaluate':
          try {
            const func = new Function('return ' + msg.expression);
            result = func();
          } catch (e) {
            result = { error: e.message };
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
