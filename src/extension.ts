import * as vscode from "vscode";
import { ProjectsProvider, ProjectEntry } from "./treeViewProvider";
import { openProjectWebview } from "./webviews/projectDetails";
import ghAvailability from "./lib/ghAvailability";
import logger from "./lib/logger";
import messages from "./lib/messages";

export async function activate(context: vscode.ExtensionContext) {
  // Non-interactive check for GitHub authentication session.
  try {
    const scopes = ["repo", "read:org", "read:user"];
    if ((vscode as any).authentication && typeof (vscode as any).authentication.getSession === "function") {
      try {
        const session = await (vscode as any).authentication.getSession("github", scopes, { createIfNone: false });
        if (!session) {
          // Offer a single non-blocking sign-in notification.
          const action = "Sign in to GitHub";
          const choice = await vscode.window.showInformationMessage(
            "ghProjects: Sign in to GitHub to enable authenticated features",
            action,
          );
          if (choice === action) {
            await vscode.commands.executeCommand("ghProjects.signIn");
          }
        }
      } catch (e) {
        logger.debug("Non-interactive auth check failed: " + String(e));
      }
    }
  } catch (e) {
    logger.debug("Auth check outer failed: " + String(e));
  }
  // Register quick-fix command for GH install docs
  context.subscriptions.push(
    vscode.commands.registerCommand("ghProjects.openInstallDocs", () => {
      vscode.env.openExternal(vscode.Uri.parse("https://cli.github.com/"));
    }),
  );
  // Check gh availability once and cache result
  try {
    await ghAvailability.checkGhOnce();
    const available = await ghAvailability.isGhAvailable();
    const version = await ghAvailability.getGhVersion();
    logger.info("activate", {
      ghAvailable: available,
      workspaceFoldersCount: (vscode.workspace.workspaceFolders || []).length,
      ghVersion: version,
    });
    if (!available) {
      logger.warn("gh not available at activation");
      vscode.window
        .showErrorMessage(messages.GH_NOT_FOUND, "Open install docs")
        .then((sel) => {
          if (sel === "Open install docs")
            vscode.commands.executeCommand("ghProjects.openInstallDocs");
        });
    }
  } catch (e: any) {
    logger.error(
      "gh availability check failed: " + String(e?.message || e || ""),
    );
  }

  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    vscode.window
      .showWarningMessage(
        "No folder is open. Open a folder to use ghProjects.",
        "Open Folder",
      )
      .then((sel) => {
        if (sel === "Open Folder")
          vscode.commands.executeCommand("vscode.openFolder");
      });
    return;
  }

  let workspaceRoot: string | undefined;
  if (folders.length === 1) {
    workspaceRoot = folders[0].uri.fsPath;
  } else {
    const pick = await vscode.window.showQuickPick(
      folders.map((f) => f.uri.fsPath),
      { placeHolder: "Select workspace folder for ghProjects" },
    );
    if (!pick) return;
    workspaceRoot = pick;
  }

  const provider = new ProjectsProvider(workspaceRoot);
  const treeView = vscode.window.createTreeView("projects", {
    treeDataProvider: provider,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand("ghProjects.checkGh", async () => {
      try {
        await ghAvailability.checkGhOnce();
        const avail = await ghAvailability.isGhAvailable();
        const ver = await ghAvailability.getGhVersion();
        logger.info("checkGh", { available: avail, version: ver });
        if (!avail) {
          const sel = await vscode.window.showWarningMessage(
            messages.GH_NOT_FOUND,
            "Open install docs",
          );
          if (sel === "Open install docs")
            vscode.commands.executeCommand("ghProjects.openInstallDocs");
        } else {
          vscode.window.showInformationMessage(
            `GitHub CLI available — ${ver || "unknown version"}`,
          );
        }
      } catch (e: any) {
        logger.error("checkGh failed: " + String(e?.message || e || ""));
        vscode.window.showErrorMessage(
          "Failed to check GitHub CLI: " + String(e?.message || e || ""),
        );
      }
    }),
    vscode.commands.registerCommand("ghProjects.refresh", () =>
      provider.refresh(),
    ),
    vscode.commands.registerCommand("ghProjects.signIn", async () => {
      const scopes = ["repo", "read:org", "read:user"];
      try {
        if (!((vscode as any).authentication && typeof (vscode as any).authentication.getSession === "function")) {
          vscode.window.showErrorMessage("GitHub authentication API is not available in this host.");
          return;
        }
        const session = await (vscode as any).authentication.getSession("github", scopes, { createIfNone: true });
        if (session && session.accessToken) {
          vscode.window.showInformationMessage("Signed in to GitHub");
        } else {
          vscode.window.showErrorMessage("Failed to sign in to GitHub. Ensure you have the correct account access (SAML/Enterprise may require extra steps).");
        }
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        vscode.window.showErrorMessage("Sign-in failed: " + msg + " — check enterprise SAML settings if applicable.");
      }
    }),
    vscode.commands.registerCommand(
      "ghProjects.openProject",
      (project: ProjectEntry) =>
        openProjectWebview(context, project, workspaceRoot),
    ),
    vscode.commands.registerCommand(
      "ghProjects.testTableQueries",
      (project: ProjectEntry) => {
        // compatibility: open same details view
        openProjectWebview(context, project as any, workspaceRoot);
      },
    ),
  );

  // Listen for workspace folder changes and refresh provider as needed
  const workspaceFoldersChange = vscode.workspace.onDidChangeWorkspaceFolders(
    (e) => {
      try {
        logger.info("workspace folders changed", {
          added: e.added?.length,
          removed: e.removed?.length,
        });
      } catch (err) {
        logger.debug("workspace change log failed: " + String(err));
      }
      try {
        provider.refresh();
      } catch (err) {
        logger.error("provider.refresh failed: " + String(err));
      }
      // If the previously selected workspaceRoot was removed, inform the user
      const stillPresent = (vscode.workspace.workspaceFolders || []).some(
        (f) => f.uri.fsPath === workspaceRoot,
      );
      if (!stillPresent) {
        vscode.window.showWarningMessage(
          'ghProjects: previously-selected workspace folder is no longer in the workspace. Run "ghProjects.refresh" or re-select a workspace.',
        );
      }
    },
  );
  context.subscriptions.push(workspaceFoldersChange);
}

// webview handling moved to `src/webviews/projectDetails.ts`

export function deactivate() {}
