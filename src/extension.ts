import * as vscode from "vscode";
import { ProjectsProvider, ProjectEntry } from "./treeViewProvider";
import { openProjectWebview } from "./webviews/projectDetails";
import findGitRepos from "./treeView/findRepos";
import getRemotesForPath from "./treeView/getRemotes";
import logger from "./lib/logger";
import messages from "./lib/messages";

export async function activate(context: vscode.ExtensionContext) {
  logger.info("activate", {
    workspaceFoldersCount: (vscode.workspace.workspaceFolders || []).length,
  });

  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    vscode.window
      .showWarningMessage(
        "No folder is open. Open a folder to use ghProjects.",
        "Open Folder"
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
      { placeHolder: "Select workspace folder for ghProjects" }
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
        // Check for a VS Code GitHub authentication session
        if (
          !(
            (vscode as any).authentication &&
            typeof (vscode as any).authentication.getSession === "function"
          )
        ) {
          vscode.window.showErrorMessage(
            "GitHub authentication API is not available in this host."
          );
          return;
        }
        const scopes = ["repo", "read:org", "read:user", "read:project"];
        const session = await (vscode as any).authentication.getSession(
          "github",
          scopes,
          { createIfNone: false }
        );
        if (!session) {
          const action = "Sign in to GitHub";
          const choice = await vscode.window.showInformationMessage(
            "Not signed in to GitHub",
            action
          );
          if (choice === action)
            await vscode.commands.executeCommand("ghProjects.signIn");
        } else {
          vscode.window.showInformationMessage("Signed in to GitHub");
        }
      } catch (e: any) {
        logger.error("checkGh failed: " + String(e?.message || e || ""));
        vscode.window.showErrorMessage(
          "Failed to check GitHub auth: " + String(e?.message || e || "")
        );
      }
    }),
    vscode.commands.registerCommand("ghProjects.refresh", () =>
      provider.refresh()
    ),
    vscode.commands.registerCommand("ghProjects.signIn", async () => {
      const scopes = ["repo", "read:org", "read:user"];
      try {
        if (
          !(
            (vscode as any).authentication &&
            typeof (vscode as any).authentication.getSession === "function"
          )
        ) {
          vscode.window.showErrorMessage(
            "GitHub authentication API is not available in this host."
          );
          return;
        }
        const session = await (vscode as any).authentication.getSession(
          "github",
          [...scopes, "read:project"],
          { createIfNone: true }
        );
        if (session && session.accessToken) {
          vscode.window.showInformationMessage("Signed in to GitHub");
        } else {
          vscode.window.showErrorMessage(
            "Failed to sign in to GitHub. Ensure you have the correct account access (SAML/Enterprise may require extra steps)."
          );
        }
      } catch (err: any) {
        const msg = String(err?.message || err || "");
        vscode.window.showErrorMessage(
          "Sign-in failed: " +
            msg +
            " — check enterprise SAML settings if applicable."
        );
      }
    }),
    vscode.commands.registerCommand("ghProjects.debugDump", async () => {
      try {
        if (!workspaceRoot) {
          vscode.window.showInformationMessage(
            "ghProjects: no workspace folder selected"
          );
          return;
        }
        const maxDepth = vscode.workspace
          .getConfiguration("ghProjects")
          .get<number>("maxDepth", 4);
        const repos = await findGitRepos(workspaceRoot, maxDepth);
        logger.info("debugDump: found repos", {
          count: repos.length,
          sample: repos.slice(0, 20),
        });
        const items: any[] = [];
        for (const r of repos.slice(0, 50)) {
          try {
            const remotes = await getRemotesForPath(r.path);
            items.push({ path: r.path, remotes });
          } catch (e) {
            items.push({
              path: r.path,
              remotes: [{ name: "error", url: String(e) }],
            });
          }
        }
        logger.info("debugDump: remotes sample", items.slice(0, 20));
        vscode.window.showInformationMessage(
          `ghProjects: debugDump written ${repos.length} repos to the Output channel`
        );
      } catch (err: any) {
        logger.error("debugDump failed: " + String(err));
        vscode.window.showErrorMessage(
          "ghProjects: debugDump failed — see Output channel"
        );
      }
    }),
    vscode.commands.registerCommand(
      "ghProjects.openProject",
      (project: ProjectEntry) =>
        openProjectWebview(context, project, workspaceRoot)
    ),
    vscode.commands.registerCommand(
      "ghProjects.testTableQueries",
      (project: ProjectEntry) => {
        // compatibility: open same details view
        openProjectWebview(context, project as any, workspaceRoot);
      }
    )
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
        (f) => f.uri.fsPath === workspaceRoot
      );
      if (!stillPresent) {
        vscode.window.showWarningMessage(
          'ghProjects: previously-selected workspace folder is no longer in the workspace. Run "ghProjects.refresh" or re-select a workspace.'
        );
      }
    }
  );
  context.subscriptions.push(workspaceFoldersChange);

  // After commands are registered, do a non-interactive auth check and offer a single sign-in notification.
  try {
    const scopes = ["repo", "read:org", "read:user"];
    if (
      (vscode as any).authentication &&
      typeof (vscode as any).authentication.getSession === "function"
    ) {
      try {
        const session = await (vscode as any).authentication.getSession(
          "github",
          [...scopes, "read:project"],
          { createIfNone: false }
        );
        if (!session) {
          // Log to the ghProjects Output channel so users can quickly see why projects
          // are not being fetched (no interactive session). Also show a single
          // interactive notification offering to sign in.
          logger.info(
            "No GitHub authentication session present — run 'Sign in to GitHub' to enable authenticated features"
          );
          const action = "Sign in to GitHub";
          const choice = await vscode.window.showInformationMessage(
            "ghProjects: Sign in to GitHub to enable authenticated features",
            action
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
}

// webview handling moved to `src/webviews/projectDetails.ts`

export function deactivate() {}
