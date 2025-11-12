"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.openProjectWebview = openProjectWebview;
const vscode = __importStar(require("vscode"));
function getNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function escapeHtml(s) {
    const str = String(s ?? '');
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function openProjectWebview(context, project) {
    const panel = vscode.window.createWebviewPanel('ghProjectView', `Project: ${project.title}`, vscode.ViewColumn.Active, {
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist'),
        ],
    });
    const webview = panel.webview;
    const bundledPath = vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js');
    const scriptUri = webview.asWebviewUri(bundledPath);
    const nonce = getNonce();
    const title = escapeHtml(project.title);
    const url = escapeHtml(project.url);
    const metaParts = [];
    if (project.number)
        metaParts.push(`#${project.number}`);
    if (typeof project.public === 'boolean')
        metaParts.push(project.public ? 'public' : 'private');
    if (project.ownerLogin)
        metaParts.push(`owner: ${escapeHtml(project.ownerLogin)}`);
    if (typeof project.repoCount === 'number')
        metaParts.push(`linked repos: ${project.repoCount}`);
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
            <p>This is a placeholder for view content.</p>
          </div>
        </vscode-tab-panel>
      `)
        .join('\n')}
  </vscode-tabs>

  <script nonce="${nonce}">
    const tabs = document.getElementById('tabs');

    function applyScrollableHeader() {
      const root = tabs.shadowRoot;
      if (!root) return false;
      const header = root.querySelector('[part="header"], .header, [role="tablist"]');
      if (!header) return false;

      // Enable scrolling and layout fixes
      header.style.display = 'flex';
      header.style.overflowX = 'auto';
      header.style.overflowY = 'hidden';
      header.style.whiteSpace = 'nowrap';
      header.style.scrollbarWidth = 'thin';
      header.style.scrollbarColor = 'var(--vscode-scrollbarSlider-background) transparent';

      // Inject thin scrollbar CSS for WebKit (closest to VS Code)
      const style = document.createElement('style');
      style.textContent = \`
        *::-webkit-scrollbar {
          height: 3px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        *::-webkit-scrollbar-thumb {
          background-color: var(--vscode-scrollbarSlider-background);
          border-radius: 0;
        }
        *::-webkit-scrollbar-thumb:hover {
          background-color: var(--vscode-scrollbarSlider-hoverBackground);
        }
        *::-webkit-scrollbar-button {
          display: none;
          width: 0;
          height: 0;
        }
      \`;
      root.appendChild(style);
      return true;
    }

    // Try immediately, and retry until tabs finish rendering
    if (!applyScrollableHeader()) {
      const interval = setInterval(() => {
        if (applyScrollableHeader()) clearInterval(interval);
      }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    }
  </script>
</body>
</html>`;
}
//# sourceMappingURL=webview.js.map