import * as vscode from 'vscode';
import type { ProjectNode } from './model';
import { fetchTableMeta, fetchTableItems } from './github/tables';

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function escapeHtml(s: string | number | boolean | undefined | null): string {
  const str = String(s ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function openProjectWebview(context: vscode.ExtensionContext, project: ProjectNode) {
  const panel = vscode.window.createWebviewPanel(
    'ghProjectView',
    `Project: ${project.title}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist'),
        vscode.Uri.joinPath(context.extensionUri, 'media'),
      ],
    }
  );

  const webview = panel.webview;
  const bundledPath = vscode.Uri.joinPath(
    context.extensionUri,
    'node_modules',
    '@vscode-elements',
    'elements',
    'dist',
    'bundled.js'
  );
  const scriptUri = webview.asWebviewUri(bundledPath);
  const appScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'app', 'main.js'));
  const nonce = getNonce();

  const title = escapeHtml(project.title);
  const url = escapeHtml(project.url);
  const metaParts: string[] = [];
  if (project.number) metaParts.push(`#${project.number}`);
  if (typeof project.public === 'boolean') metaParts.push(project.public ? 'public' : 'private');
  if (project.ownerLogin) metaParts.push(`owner: ${escapeHtml(project.ownerLogin)}`);
  if (typeof project.repoCount === 'number') metaParts.push(`linked repos: ${project.repoCount}`);
  const meta = metaParts.join(' • ');
  const views = project.views ?? [];
  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 img-src ${webview.cspSource} https: data:;
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}' ${webview.cspSource};
                 font-src ${webview.cspSource} https: data:;
                 connect-src ${webview.cspSource} https:;" />
  <title>Project: ${title}</title>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  <script nonce="${nonce}">window.WEBVIEW_STATE = ${JSON.stringify({ projectId: project.id, views })};</script>
  <script type="module" nonce="${nonce}" src="${appScriptUri}"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }
    .container { padding: 12px; }
    .meta { color: var(--vscode-descriptionForeground); }
    .table-view a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .table-view a:hover { text-decoration: underline; }

    /* Make tab header scroll gracefully when there are many/long tabs */
    vscode-tabs::part(header) {
      display: flex;
      overflow-x: auto;
      overflow-y: hidden;
      white-space: nowrap;
      scrollbar-width: thin;
      scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
    }
    /* Ensure each tab doesn't stretch; allow ellipsis for long names */
    vscode-tabs::part(tab) {
      flex: 0 0 auto;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* WebKit scrollbar styling for the header */
    vscode-tabs::part(header)::-webkit-scrollbar { height: 8px; }
    vscode-tabs::part(header)::-webkit-scrollbar-track { background: transparent; }
    vscode-tabs::part(header)::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <vscode-tabs id="tabs" panel selected-index="0">
    <vscode-tab-header slot="header">Overview</vscode-tab-header>
    <vscode-tab-panel>
      <div class="container">
        <h2>${title}</h2>
        <p class="meta">${escapeHtml(project.owner)}/${escapeHtml(project.repo)} • ${meta}</p>
        <p><a href="${url}">${url}</a></p>
        <p>Views: ${views.length}</p>
      </div>
    </vscode-tab-panel>

    ${views
      .map(v => `
        <vscode-tab-header slot="header">${escapeHtml(v.name)}</vscode-tab-header>
        <vscode-tab-panel>
          <div class="container">
            <h3>${escapeHtml(v.name)} (#${escapeHtml(v.number)})</h3>
            <p class="meta">Select this tab to load content…</p>
            <div id="view-${escapeHtml(v.number)}" class="table-view" data-view-number="${escapeHtml(v.number)}"></div>
          </div>
        </vscode-tab-panel>
      `)
      .join('\n')}
  </vscode-tabs>
</body>
</html>`;

  // Handle messages from the webview to load data for a view on demand
  const metaCache = new Map<number, any>();
  panel.webview.onDidReceiveMessage(
    async (msg: any) => {
      try {
        if (!msg || msg.type !== 'loadView') return;
        const viewNumber: number = msg.viewNumber;
        if (typeof viewNumber !== 'number') return;

        const session = await vscode.authentication.getSession('github', ['repo', 'read:project'], { createIfNone: true });
        const token = session?.accessToken;
        if (!token) {
          panel.webview.postMessage({ type: 'error', payload: { viewNumber, message: 'Missing GitHub token.' } });
          return;
        }

        let meta = metaCache.get(viewNumber) as any;
        if (!meta) {
          meta = await fetchTableMeta(project.id, viewNumber, token);
          metaCache.set(viewNumber, meta);
        }

        if (meta.layout !== 'TABLE') {
          panel.webview.postMessage({ type: 'viewData', payload: { viewNumber, layout: meta.layout, meta, items: [] } });
          return;
        }

        const page = await fetchTableItems(project.id, meta, token);
        panel.webview.postMessage({ type: 'viewData', payload: { viewNumber, layout: meta.layout, meta, items: page.items } });
      } catch (err: any) {
        const viewNumber: number | undefined = msg?.viewNumber;
        panel.webview.postMessage({ type: 'error', payload: { viewNumber, message: err?.message ?? String(err) } });
      }
    },
    undefined,
    context.subscriptions
  );

  panel.onDidDispose(() => {
    metaCache.clear();
  }, null, context.subscriptions);
}
