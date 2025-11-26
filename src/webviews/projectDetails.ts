import * as vscode from "vscode";
import { ProjectEntry } from "../lib/types";
import { GitHubRepository } from "../services/GitHubRepository";
import messages, { isGhNotFound } from "../lib/messages";
import logger from "../lib/logger";
import { wrapError } from "../lib/errors";
import { ProjectSnapshot, ProjectView } from "../lib/types";
import { buildHtml, getNonce } from "./htmlBuilder";
import { ProjectDataService } from "../services/ProjectDataService";

// Panels map: panelKey -> WebviewPanel
const panels = new Map<string, vscode.WebviewPanel>();

export async function openProjectWebview(
  context: vscode.ExtensionContext,
  project: ProjectEntry,
  workspaceRoot?: string
) {
  // Fetch project views to determine view number for stable panelKey
  let views: ProjectView[] = Array.isArray(project.views) ? project.views : [];
  if (!views.length && project.id) {
    try {
      views = await GitHubRepository.getInstance().fetchProjectViews(project.id);
      project.views = views;
      logger.debug(`[ghProjects] Assigned ${views.length} views to project ${project.id}`);
    } catch (e) {
      logger.warn("Failed to fetch project views for panelKey: " + String(e));
    }
  } else {
    logger.debug(`[ghProjects] Project ${project.id} already has ${views.length} views`);
  }

  // Attempt to fetch richer view details (fields, grouping, sorting) for each view
  // so the webview can present more accurate layout and field metadata.
  if (project.id && Array.isArray(views) && views.length > 0) {
    try {
      const detailed: Array<any> = [];
      for (let i = 0; i < views.length; i++) {
        const v = views[i];
        if (v && typeof v.number === "number") {
          try {
            const det = await GitHubRepository.getInstance().getProjectViewDetails(project.id, v.number as number);
            if (det) {
              // attach details onto the view object
              (v as any).details = det;
              // If there's a saved filter in workspaceState for this view, prefer it
              try {
                const storageKey = `viewFilter:${project.id}:${v.number}`;
                const saved = await context.workspaceState.get<string>(
                  storageKey
                );
                if (typeof saved === "string") {
                  (v as any).details.filter = saved;
                }
              } catch (e) {
                // ignore workspace storage errors
              }
            }
          } catch (err) {
            logger.debug(
              `fetchViewDetails failed for project ${project.id} view ${String(
                v.number
              )}: ${String((err as any)?.message || err || "")}`
            );
          }
        }
      }
    } catch (e) {
      logger.debug(
        "fetchViewDetails loop failed: " +
        String((e as any)?.message || e || "")
      );
    }
  }

  // Panels are keyed by workspaceRoot + project id/title for stability
  const panelMapKey = `${workspaceRoot ?? "<no-workspace>"}::${project.id
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

  // Create new panel (allow loading local resources from `media`)
  const panel = vscode.window.createWebviewPanel(
    "ghProjects.projectDetails",
    project.title ?? String(project.id ?? "Project Details"),
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
    }
  );
  panels.set(panelMapKey, panel);
  panel.onDidDispose(
    () => panels.delete(panelMapKey),
    null,
    context.subscriptions
  );

  // Use new path for vscode-elements.js
  const elementsUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "third-party",
      "vscode-elements.js"
    )
  );
  // compute fetcher URIs - prefer bundled (dist) scripts when available
  const useBundledSetting = vscode.workspace
    .getConfiguration("ghProjects")
    .get<boolean>("useBundledWebviews", false);
  let webviewFolder = useBundledSetting ? "dist" : "webviews";
  // If user hasn't explicitly enabled bundled webviews, prefer `dist` when it exists
  if (!useBundledSetting) {
    try {
      const distUri = vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "dist"
      );
      // workspace.fs.stat will throw if path does not exist
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await vscode.workspace.fs.stat(distUri);
      webviewFolder = "dist";
    } catch (e) {
      // dist not present, keep 'webviews'
    }
  }

  const overviewUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "overviewFetcher.js"
    )
  );
  const tableUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "tableViewFetcher.js"
    )
  );
  const helperUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "filterBarHelper.js"
    )
  );
  const boardUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "boardViewFetcher.js"
    )
  );
  const roadmapUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "roadmapViewFetcher.js"
    )
  );
  const contentUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      webviewFolder,
      "contentFetcher.js"
    )
  );
  // optional patch script (applies DOM fixes to bundled fetchers)
  const patchUri =
    webviewFolder === "dist"
      ? panel.webview.asWebviewUri(
        vscode.Uri.joinPath(
          context.extensionUri,
          "media",
          "dist",
          "tableViewFetcher.patch.js"
        )
      )
      : undefined;

  // Get VS Code webview shim URI (provides window.vscodeApi for extension communication)
  const vscodeShimUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "shim",
      "vscode-webview-shim.js"
    )
  );

  // Generate HTML using buildHtml (no longer loading from external index.html)
  panel.webview.html = buildHtml(
    panel.webview,
    project,
    elementsUri.toString(),
    {
      overviewUri,
      tableUri,
      boardUri,
      roadmapUri,
      contentUri,
      patchUri,
      helperUri,
    },
    panelMapKey,
    vscodeShimUri.toString()
  );



  panel.webview.onDidReceiveMessage(
    async (msg) => {
      // Special-case: the UI may send a 'ready' handshake when it has initialized.
      // Resend the init payload so the page reliably receives it even if it initialized after the extension posted.
      try {
        if (msg && typeof msg === 'object' && msg.command === 'ready') {
          try {
            const resend = {
              command: 'init',
              project: {
                title: project.title,
                repos: project.repos ?? [],
                views: Array.isArray(project.views) ? project.views : [],
                description: project.description ?? "",
                panelKey: panelMapKey,
              },
              panelKey: panelMapKey,
              resources: {
                overview: overviewUri?.toString(),
                table: tableUri?.toString(),
                helper: helperUri?.toString(),
                board: boardUri?.toString(),
                roadmap: roadmapUri?.toString(),
                content: contentUri?.toString(),
                patch: patchUri?.toString(),
                elements: elementsUri?.toString(),
              }
            };
            panel.webview.postMessage(resend);
          } catch (e) { }
          return;
        }
      } catch (e) { }

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
          }
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
        const _reqMsg = `webview.requestFields received viewKey=${String(
          reqViewKey
        )} projectId=${project.id}`;
        logger.debug(_reqMsg);
        try {
          const { snapshot, effectiveFilter, itemsCount } = await ProjectDataService.getProjectData(project, reqViewKey);

          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: snapshot,
            effectiveFilter: effectiveFilter,
            itemsCount: itemsCount,
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
            level
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
      // Set a view-level filter (Save). Update in-memory view details and refresh snapshot
      if (msg?.command === "setViewFilter") {
        try {
          const reqViewKey = (msg as any).viewKey as string | undefined;
          const newFilter = (msg as any).filter;
          if (!reqViewKey) return;
          let localKey = String(reqViewKey).split(":").pop();
          let viewIdx = 0;
          if (localKey && localKey.startsWith("view-")) {
            const idx = Number(localKey.split("-")[1]);
            if (!isNaN(idx)) viewIdx = idx;
          }
          const viewsArr: ProjectView[] = Array.isArray(project.views)
            ? project.views
            : [];
          const view = viewsArr[viewIdx];
          // Update in-memory details.filter
          if (view) {
            if (!(view as any).details) (view as any).details = {};
            (view as any).details.filter =
              typeof newFilter === "string" ? newFilter : undefined;
          }
          // Persist saved filter to workspaceState so it survives reloads
          try {
            const storageKey = `viewFilter:${project.id}:${view && view.number
              }`;
            await context.workspaceState.update(
              storageKey,
              (view && (view as any).details && (view as any).details.filter) ||
              undefined
            );
          } catch (e) {
            logger.debug("workspaceState.update failed: " + String(e));
          }

          const { snapshot, effectiveFilter } = await ProjectDataService.getProjectData(project, reqViewKey);

          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: snapshot,
            effectiveFilter: effectiveFilter,
          });
        } catch (e) {
          const wrapped = wrapError(e, "setViewFilter failed");
          const msgText = String(wrapped?.message || wrapped || "");
          logger.error("setViewFilter failed: " + msgText);
          panel.webview.postMessage({
            command: "fields",
            viewKey: (msg as any).viewKey || null,
            error: msgText,
          });
        }
      }
      // Discard edits to the view filter: re-fetch using the current stored filter value and refresh
      if (msg?.command === "discardViewFilter") {
        try {
          const reqViewKey = (msg as any).viewKey as string | undefined;
          if (!reqViewKey) return;
          let localKey = String(reqViewKey).split(":").pop();
          let viewIdx = 0;
          if (localKey && localKey.startsWith("view-")) {
            const idx = Number(localKey.split("-")[1]);
            if (!isNaN(idx)) viewIdx = idx;
          }
          const viewsArr: ProjectView[] = Array.isArray(project.views)
            ? project.views
            : [];
          const view = viewsArr[viewIdx];

          // Restore the saved filter from workspaceState (if any), otherwise keep existing
          try {
            const storageKey = `viewFilter:${project.id}:${view && view.number
              }`;
            const saved = await context.workspaceState.get<string>(storageKey);
            if (typeof saved === "string") {
              if (!view) (view as any) = {};
              if (!(view as any).details) (view as any).details = {};
              (view as any).details.filter = saved;
            }
          } catch (e) {
            // ignore
          }

          const { snapshot, effectiveFilter } = await ProjectDataService.getProjectData(project, reqViewKey);

          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: snapshot,
            effectiveFilter: effectiveFilter,
          });
        } catch (e) {
          const wrapped = wrapError(e, "discardViewFilter failed");
          const msgText = String(wrapped?.message || wrapped || "");
          logger.error("discardViewFilter failed: " + msgText);
          panel.webview.postMessage({
            command: "fields",
            viewKey: (msg as any).viewKey || null,
            error: msgText,
          });
        }
      }
      // Set a view-level grouping (Save). Update in-memory view details and refresh snapshot
      if (msg?.command === "setViewGrouping") {
        try {
          const reqViewKey = (msg as any).viewKey as string | undefined;
          const newGrouping = (msg as any).grouping;
          if (!reqViewKey) return;
          let localKey = String(reqViewKey).split(":").pop();
          let viewIdx = 0;
          if (localKey && localKey.startsWith("view-")) {
            const idx = Number(localKey.split("-")[1]);
            if (!isNaN(idx)) viewIdx = idx;
          }
          const viewsArr: ProjectView[] = Array.isArray(project.views)
            ? project.views
            : [];
          const view = viewsArr[viewIdx];
          // Update in-memory details.groupByFields
          if (view) {
            if (!(view as any).details) (view as any).details = {};
            (view as any).details.groupByFields =
              typeof newGrouping === "string" && newGrouping
                ? { nodes: [{ name: newGrouping }] }
                : undefined;
          }
          // Persist saved grouping to workspaceState so it survives reloads
          try {
            const storageKey = `viewGrouping:${project.id}:${view && view.number}`;
            await context.workspaceState.update(
              storageKey,
              (view && (view as any).details && (view as any).details.groupByFields && (view as any).details.groupByFields.nodes && (view as any).details.groupByFields.nodes[0] && (view as any).details.groupByFields.nodes[0].name) ||
              undefined
            );
          } catch (e) {
            logger.debug("workspaceState.update (grouping) failed: " + String(e));
          }

          const { snapshot, effectiveFilter } = await ProjectDataService.getProjectData(project, reqViewKey);

          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: snapshot,
            effectiveFilter: effectiveFilter,
          });
        } catch (e) {
          const wrapped = wrapError(e, "setViewGrouping failed");
          const msgText = String(wrapped?.message || wrapped || "");
          logger.error("setViewGrouping failed: " + msgText);
          panel.webview.postMessage({
            command: "fields",
            viewKey: (msg as any).viewKey || null,
            error: msgText,
          });
        }
      }
      // Discard edits to the view grouping: re-fetch using the current stored grouping value and refresh
      if (msg?.command === "discardViewGrouping") {
        try {
          const reqViewKey = (msg as any).viewKey as string | undefined;
          if (!reqViewKey) return;
          let localKey = String(reqViewKey).split(":").pop();
          let viewIdx = 0;
          if (localKey && localKey.startsWith("view-")) {
            const idx = Number(localKey.split("-")[1]);
            if (!isNaN(idx)) viewIdx = idx;
          }
          const viewsArr: ProjectView[] = Array.isArray(project.views)
            ? project.views
            : [];
          const view = viewsArr[viewIdx];

          // Restore the saved grouping from workspaceState (if any), otherwise keep existing
          try {
            const storageKey = `viewGrouping:${project.id}:${view && view.number}`;
            const saved = await context.workspaceState.get<string>(storageKey);
            if (typeof saved === "string") {
              if (!view) (view as any) = {};
              if (!(view as any).details) (view as any).details = {};
              (view as any).details.groupByFields = { nodes: [{ name: saved }] };
            }
          } catch (e) {
            // ignore
          }

          const { snapshot, effectiveFilter } = await ProjectDataService.getProjectData(project, reqViewKey);

          panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: snapshot,
            effectiveFilter: effectiveFilter,
          });
        } catch (e) {
          const wrapped = wrapError(e, "discardViewGrouping failed");
          const msgText = String(wrapped?.message || wrapped || "");
          logger.error("discardViewGrouping failed: " + msgText);
          panel.webview.postMessage({
            command: "fields",
            viewKey: (msg as any).viewKey || null,
            error: msgText,
          });
        }
      }
      
    },
    undefined,
    context.subscriptions
  );
}



export default { openProjectWebview };
