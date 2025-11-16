import * as vscode from "vscode";
import { ProjectEntry } from "../treeViewProvider";
import ghClient from "../github/ghClient";
import messages, { isGhNotFound } from "../lib/messages";
import logger from "../lib/logger";
import { wrapError } from "../lib/errors";
import { ProjectSnapshot, ProjectView } from "../lib/types";

// Panels map: panelKey -> WebviewPanel
const panels = new Map<string, vscode.WebviewPanel>();

export async function openProjectWebview(
  context: vscode.ExtensionContext,
  project: ProjectEntry,
  workspaceRoot?: string,
) {
  // Fetch project views to determine view number for stable panelKey
  let views: ProjectView[] = Array.isArray(project.views) ? project.views : [];
  if (!views.length && project.id) {
    try {
      views = await ghClient.fetchProjectViews(project.id);
    } catch (e) {
      logger.warn("Failed to fetch project views for panelKey: " + String(e));
    }
  }

  // Panels are keyed by workspaceRoot + project id/title for stability
  const panelMapKey = `${workspaceRoot ?? "<no-workspace>"}::${
    project.id
      ? String(project.id)
      : project.title
        ? String(project.title)
        : "<unknown>"
  }`;

  // Reuse panel if already open
  if (panels.has(panelMapKey)) {
    const panel = panels.get(panelMapKey)!;
    panel.reveal(vscode.ViewColumn.One);
    // Optionally update content if needed (post latest snapshot)
    // No single viewKey for refresh; let webview handle refresh for all tabs
    panel.webview.postMessage({ command: "refresh" });
    return panel;
  }

  // Create new panel
  const panel = vscode.window.createWebviewPanel(
    "ghProjects.projectDetails",
    project.title ?? String(project.id ?? "Project Details"),
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panels.set(panelMapKey, panel);
  panel.onDidDispose(
    () => panels.delete(panelMapKey),
    null,
    context.subscriptions,
  );

  // Use new path for vscode-elements.js
  const elementsUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "third-party",
      "vscode-elements.js",
    ),
  );
  // compute fetcher URIs
  const overviewUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "webviews",
      "overviewFetcher.js",
    ),
  );
  const tableUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "webviews",
      "tableViewFetcher.js",
    ),
  );
  const boardUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "webviews",
      "boardViewFetcher.js",
    ),
  );
  const roadmapUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "webviews",
      "roadmapViewFetcher.js",
    ),
  );
  const contentUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "webviews",
      "contentFetcher.js",
    ),
  );

  panel.webview.html = buildHtml(
    panel.webview,
    project,
    elementsUri.toString(),
    { overviewUri, tableUri, boardUri, roadmapUri, contentUri },
    panelMapKey,
  );

  panel.webview.onDidReceiveMessage(
    async (msg) => {
      // Basic validation of incoming message object and command
      if (!msg || typeof msg !== "object" || typeof msg.command !== "string") {
        panel.webview.postMessage({
          command: "fields",
          viewKey:
            msg && (msg as any).viewKey ? String((msg as any).viewKey) : null,
          error: "Invalid message format",
          authRequired: false,
        });
        return;
      }

      // Only handle messages for this panel (ignore if no viewKey for this project)
      if (!msg?.viewKey) return;

      if (
        msg?.command === "openRepo" &&
        typeof (msg as any).path === "string"
      ) {
        vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(msg.path),
          {
            forceNewWindow: false,
          },
        );
      }
      if (msg?.command === "openUrl" && typeof (msg as any).url === "string") {
        try {
          const u = vscode.Uri.parse(String((msg as any).url));
          await vscode.env.openExternal(u);
        } catch (e) {
          const sanitized = String((e as any)?.message || e || "");
          logger.error("webview.openUrl failed: " + sanitized);
          vscode.window.showErrorMessage("Failed to open URL: " + sanitized);
        }
      }
      if (msg?.command === "requestFields") {
        const reqViewKey = (msg as any).viewKey as string | undefined;
        // validate fields
        if (reqViewKey !== undefined && typeof reqViewKey !== "string") {
          panel.webview.postMessage({
            command: "fields",
            viewKey: null,
            error: "Invalid requestFields: viewKey must be a string",
            authRequired: false,
          });
          return;
        }
        if (
          (msg as any).first !== undefined &&
          typeof (msg as any).first !== "number"
        ) {
          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey ?? null,
            error: "Invalid requestFields: first must be a number",
            authRequired: false,
          });
          return;
        }
        const _reqMsg = `webview.requestFields received viewKey=${String(reqViewKey)} projectId=${project.id}`;
        logger.debug(_reqMsg);
        try {
          // Determine which view is being requested. viewKey can be composite like
          // "<panelKey>:view-0" or "<panelKey>:overview" so extract suffix after last ':'
          let localKey = reqViewKey
            ? String(reqViewKey).split(":").pop()
            : undefined;
          let viewIdx = 0;
          if (localKey && localKey.startsWith("view-")) {
            const idx = Number(localKey.split("-")[1]);
            if (!isNaN(idx)) viewIdx = idx;
          }
          const viewsArr: ProjectView[] = Array.isArray(project.views)
            ? project.views
            : [];
          const view = viewsArr[viewIdx];
          const first = vscode.workspace
            .getConfiguration("ghProjects")
            .get<number>("itemsFirst", 50);
          logger.debug(
            `[ghProjects] Fetching project fields for projectId=${project.id} viewIdx=${viewIdx} first=${first}`,
          );
          // If the view has a type, you could branch here for board/roadmap, etc.
          // For now, always fetch fields (table/board/roadmap fetchers can use the same API or branch as needed)
          // If needed, pass view-specific info to fetchProjectFields here (or filter after fetch)
          const snapshot: ProjectSnapshot = await ghClient.fetchProjectFields(
            project.id as string,
            { first },
          );
          logger.debug(`[ghProjects] fetchProjectFields result`);
          const itemsCount =
            (snapshot &&
              (snapshot as any).items &&
              (snapshot as any).items.length) ||
            0;
          const _postMsg = `webview.postMessage fields viewKey=${String(reqViewKey)} items=${itemsCount}`;
          logger.debug(_postMsg);
          // Do not post stack traces or full objects that may contain tokens.
          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: snapshot,
          });
        } catch (e) {
          const wrapped = wrapError(e, "requestFields failed");
          const msgText = String(wrapped?.message || wrapped || "");
          logger.error("requestFields failed: " + msgText);
          if ((wrapped as any)?.code === "ENOENT" || isGhNotFound(wrapped)) {
            vscode.window.showErrorMessage(messages.GH_NOT_FOUND);
          }
          const isAuth = (wrapped as any)?.code === "ENOTAUTH";
          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            error: msgText,
            authRequired: Boolean(isAuth),
          });
        }
      }
      // accept debug logs from webview fetchers and write them to the Output channel
      if (msg?.command === "debugLog") {
        try {
          let level = (msg as any).level || "debug";
          if (typeof level !== "string") level = "debug";
          level = (["debug", "info", "warn", "error"] as string[]).includes(
            level,
          )
            ? level
            : "debug";
          const vk = (msg as any).viewKey
            ? ` viewKey=${String((msg as any).viewKey)}`
            : "";
          const text = String((msg as any).message || (msg as any).msg || "");
          const data =
            (msg as any).data !== undefined ? (msg as any).data : undefined;
          const formatted =
            `webview:${vk} ${text}` + (data ? ` ${JSON.stringify(data)}` : "");
          if (level === "info") logger.info(formatted);
          else if (level === "warn") logger.warn(formatted);
          else if (level === "error") logger.error(formatted);
          else logger.debug(formatted);
        } catch (e) {
          const fm = `webview.debugLog parse failed: ${String(e)}`;
          logger.debug(fm);
        }
      }
    },
    undefined,
    context.subscriptions,
  );
}

function buildHtml(
  webview: vscode.Webview,
  project: ProjectEntry,
  elementsScriptUri?: string,
  fetcherUris?: {
    overviewUri: vscode.Uri;
    tableUri: vscode.Uri;
    boardUri: vscode.Uri;
    roadmapUri: vscode.Uri;
    contentUri: vscode.Uri;
  },
  panelKey?: string,
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
        `<script nonce="${nonce}" src="${fetcherUris.overviewUri.toString()}"></script>`,
        `<script nonce="${nonce}" src="${fetcherUris.tableUri.toString()}"></script>`,
        `<script nonce="${nonce}" src="${fetcherUris.boardUri.toString()}"></script>`,
        `<script nonce="${nonce}" src="${fetcherUris.roadmapUri.toString()}"></script>`,
        `<script nonce="${nonce}" src="${fetcherUris.contentUri.toString()}"></script>`,
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

${scriptTag}
</head>
<body>
<div id="root">
  <div id="tabs-container"></div>
  <div id="tab-panels"></div>
</div>
${/* expose project data and vscodeApi for media scripts */ ""}
<script nonce="${nonce}">
  window.__project_data__ = ${JSON.stringify(projectData)};
  try { window.vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null; } catch(e) { window.vscodeApi = null; }
</script>

${fetcherScripts}

<script nonce="${nonce}" type="module">
const vscodeApi = window.vscodeApi || (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null);
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
    // activate fetcher for this tab (on-demand)
    try {
      activateTabFetcher(key);
    } catch (e) {
      try { console.debug('activateTabFetcher failed: ' + String(e)); } catch (_) {}
    }
  }

  // Initialize first tab
  showTab('overview', tabsContainer.children[0]);

  // We'll initialize fetchers only when a tab is activated (on demand).
  // This avoids multiple fetchers racing or running for non-active tabs.
  const initialized = {};

  // helper to activate a given tab key and run its fetcher if needed
  function activateTabFetcher(key){
    if(key === 'overview'){
      const ov = panelsMap['overview'];
      if(ov && !initialized['overview']){
        if(typeof window.overviewFetcher === 'function') window.overviewFetcher(ov, project.panelKey + ':overview');
        initialized['overview'] = true;
      }
      return;
    }
    if(String(key).startsWith('view-')){
      const idx = Number(String(key).split('-')[1]);
      const view = (project.views ?? [])[idx];
      const p = panelsMap['view-'+idx];
      const vk = 'view-' + idx;
      // Debug: print view and layout
      try { console.log('[ghProjects] Tab', key, 'view:', view, 'layout:', view && view.layout); } catch(e){}
      if(p && view && !initialized[vk]){
        if(typeof window.contentFetcher === 'function') window.contentFetcher(view, p, project.panelKey + ':' + vk);
        initialized[vk] = true;
      }
    }
  }

  // Initialize only the overview on first render (showTab will call this too)
  activateTabFetcher('overview');

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
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 16; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

export default { openProjectWebview };
