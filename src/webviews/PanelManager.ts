import * as vscode from "vscode";
import { ProjectEntry } from "../lib/types";
import { buildHtml } from "./htmlBuilder";

export class PanelManager {
  private static instance: PanelManager;
  private panels = new Map<string, vscode.WebviewPanel>();

  private constructor() {}

  public static getInstance(): PanelManager {
    if (!PanelManager.instance) {
      PanelManager.instance = new PanelManager();
    }
    return PanelManager.instance;
  }

  public getPanel(key: string): vscode.WebviewPanel | undefined {
    return this.panels.get(key);
  }

  public addPanel(
    key: string,
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ) {
    this.panels.set(key, panel);
    panel.onDidDispose(
      () => this.panels.delete(key),
      null,
      context.subscriptions,
    );
  }

  public createPanel(
    context: vscode.ExtensionContext,
    project: ProjectEntry,
    panelMapKey: string,
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      "ghProjects.projectDetails",
      project.title ?? String(project.id ?? "Project Details"),
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      },
    );
    this.addPanel(panelMapKey, panel, context);
    return panel;
  }

  public getWebviewContent(
    context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    project: ProjectEntry,
    panelMapKey: string,
  ): string {
    // Use new path for vscode-elements.js
    const elementsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "third-party",
        "vscode-elements.js",
      ),
    );
    // compute fetcher URIs - prefer bundled (dist) scripts when available
    const useBundledSetting = vscode.workspace
      .getConfiguration("ghProjects")
      .get<boolean>("useBundledWebviews", false);
    let webviewFolder = useBundledSetting ? "dist" : "webviews";
    // If user hasn't explicitly enabled bundled webviews, prefer `dist` when it exists
    // Note: This check should ideally be done once or cached, but for now we keep it here
    // We can't easily do async fs check here if we want this to be synchronous or we need to await it before calling this.
    // For now, we assume the caller handles the async check or we just default to webviews if not sure.
    // But wait, the original code did an async check.

    // We will pass the folder as an argument or handle it outside.
    // Let's assume the caller determines the folder.

    return ""; // Placeholder, will implement properly
  }

  public getAllPanels(): vscode.WebviewPanel[] {
    return Array.from(this.panels.values());
  }

  public getFirstPanel(): vscode.WebviewPanel | undefined {
    const allPanels = Array.from(this.panels.values());
    return allPanels.length > 0 ? allPanels[0] : undefined;
  }
}
