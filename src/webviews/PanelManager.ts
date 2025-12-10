import * as vscode from "vscode";
import { ProjectEntry } from "../lib/types";

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

  public getAllPanels(): vscode.WebviewPanel[] {
    return Array.from(this.panels.values());
  }

  public getFirstPanel(): vscode.WebviewPanel | undefined {
    const allPanels = Array.from(this.panels.values());
    return allPanels.length > 0 ? allPanels[0] : undefined;
  }
}
