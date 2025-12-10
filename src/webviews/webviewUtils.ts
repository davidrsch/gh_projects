import * as vscode from "vscode";

export async function getWebviewFolder(
  context: vscode.ExtensionContext,
): Promise<string> {
  const useBundledSetting = vscode.workspace
    .getConfiguration("ghProjects")
    .get<boolean>("useBundledWebviews", false);

  if (useBundledSetting) {
    return "dist";
  }

  try {
    const distUri = vscode.Uri.joinPath(context.extensionUri, "media", "dist");
    await vscode.workspace.fs.stat(distUri);
    return "dist";
  } catch (e) {
    return "webviews";
  }
}

export function getWebviewResources(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  webviewFolder: string,
) {
  const elementsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "third-party",
      "vscode-elements.js",
    ),
  );

  const overviewUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "overviewFetcher.js",
    ),
  );
  const tableUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "tableViewFetcher.js",
    ),
  );
  const helperUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "filterBarHelper.js",
    ),
  );
  const boardUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "boardViewFetcher.js",
    ),
  );
  const roadmapUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "roadmapViewFetcher.js",
    ),
  );
  const contentUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "contentFetcher.js",
    ),
  );
  const patchUri =
    webviewFolder === "dist"
      ? webview.asWebviewUri(
          vscode.Uri.joinPath(
            context.extensionUri,
            "media",
            "dist",
            "tableViewFetcher.patch.js",
          ),
        )
      : undefined;

  const vscodeShimUri = webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "shim",
      "vscode-webview-shim.js",
    ),
  );

  return {
    elementsUri,
    fetcherUris: {
      overviewUri,
      tableUri,
      boardUri,
      roadmapUri,
      contentUri,
      patchUri,
      helperUri,
    },
    vscodeShimUri,
  };
}
