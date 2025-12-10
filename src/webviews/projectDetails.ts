import * as vscode from "vscode";
import { ProjectEntry } from "../lib/types";
import { buildHtml } from "./htmlBuilder";
import { PanelManager } from "./PanelManager";
import { MessageHandler } from "./MessageHandler";
import { getWebviewFolder, getWebviewResources } from "./webviewUtils";
import { ViewDataService } from "./ViewDataService";

export async function openProjectWebview(
  context: vscode.ExtensionContext,
  project: ProjectEntry,
  workspaceRoot?: string,
) {
  // Fetch project views
  const views = await ViewDataService.fetchProjectViews(project);

  // Enrich view details
  await ViewDataService.enrichViewDetails(context, project, views);

  // Panels are keyed by workspaceRoot + project id/title for stability
  const panelMapKey = `${workspaceRoot ?? "<no-workspace>"}::${
    project.id
      ? String(project.id)
      : project.title
        ? String(project.title)
        : "<unknown>"
  }`;

  const panelManager = PanelManager.getInstance();
  let panel = panelManager.getPanel(panelMapKey);

  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    panel.webview.postMessage({ command: "refresh" });
    return panel;
  }

  panel = panelManager.createPanel(context, project, panelMapKey);

  const webviewFolder = await getWebviewFolder(context);
  const resources = getWebviewResources(context, panel.webview, webviewFolder);

  panel.webview.html = buildHtml(
    panel.webview,
    project,
    resources.elementsUri.toString(),
    resources.fetcherUris,
    panelMapKey,
    resources.vscodeShimUri.toString(),
  );

  const messageHandler = new MessageHandler(
    panel,
    project,
    panelMapKey,
    context,
    resources,
  );
  messageHandler.attach();

  return panel;
}

// Test helpers to expose webview panels for integration testing
export function getAllPanelsForTesting(): vscode.WebviewPanel[] {
  return PanelManager.getInstance().getAllPanels();
}

export function getFirstPanelForTesting(): vscode.WebviewPanel | undefined {
  return PanelManager.getInstance().getFirstPanel();
}

export default { openProjectWebview };
