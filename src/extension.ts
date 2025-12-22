import * as vscode from "vscode";
import { ProjectsProvider } from "./treeViewProvider";
import { ProjectEntry } from "./lib/types";
import { openProjectWebview } from "./webviews/projectDetails";
import logger from "./lib/logger";
import messages from "./lib/messages";

import { ProjectChatParticipant } from "./chat/projectParticipant";
import { ProjectService } from "./services/projectService";

export async function activate(context: vscode.ExtensionContext) {
  logger.info("activate", {
    workspaceFoldersCount: (vscode.workspace.workspaceFolders || []).length,
  });

  // Initialize Chat Participant
  const projectService = new ProjectService();
  new ProjectChatParticipant(context, projectService);

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

  const provider = new ProjectsProvider(workspaceRoot, projectService);
  const treeView = vscode.window.createTreeView("projects", {
    treeDataProvider: provider,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand("ghProjects.refresh", () =>
      provider.refresh(),
    ),
    vscode.commands.registerCommand("ghProjects.signIn", async () => {
      try {
        const authManager = (
          await import("./services/AuthenticationManager")
        ).AuthenticationManager.getInstance();
        await authManager.ensureAuthenticated();
        vscode.window.showInformationMessage("Signed in to GitHub");
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Sign in failed: ${error}`);
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

  // Initial auth check
  try {
    if (process.env.GH_PROJECTS_TOKEN_FOR_TESTING) {
      logger.info("Skipping initial auth check for testing");
      return;
    }
    const authManager = (
      await import("./services/AuthenticationManager")
    ).AuthenticationManager.getInstance();
    const session = await authManager.getSession(false);
    if (!session) {
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
    logger.debug("Auth check failed: " + String(e));
  }
}

// webview handling moved to `src/webviews/projectDetails.ts`

export function deactivate() {}
