import * as vscode from "vscode";
import { ProjectEntry } from "../lib/types";
import { TEST_HANDLER_CODE } from "./testHandlerCode";
import {
  getNonce,
  getCspMetaTag,
  getStyles,
  getScriptTags,
  getInlineScript,
  getTestHandlerScript,
} from "./htmlHelpers";

export { getNonce };

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
  vscodeShimUri?: string,
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
${getCspMetaTag(nonce, csp)}
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${projectData.title}</title>
${getStyles()}
${getScriptTags(nonce, fetcherUris, vscodeShimUri, elementsScriptUri)}
</head>
<body>
<div id="root">
  <div id="tabs-container"></div>
  <div id="tab-panels"></div>
</div>
${getInlineScript(nonce, projectData)}
${getTestHandlerScript(nonce, TEST_HANDLER_CODE)}
</body>
</html>`;
}
