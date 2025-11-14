import * as vscode from 'vscode';
import { ProjectsProvider, ProjectEntry } from './treeViewProvider';
import { openProjectWebview } from './webviews/projectDetails';

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri.fsPath;

  const provider = new ProjectsProvider(workspaceRoot);
  const treeView = vscode.window.createTreeView('projects', { treeDataProvider: provider });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand('ghProjects.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('ghProjects.openProject', (project: ProjectEntry) => openProjectWebview(context, project)),
    vscode.commands.registerCommand('ghProjects.testTableQueries', (project: ProjectEntry) => {
      // compatibility: open same details view
      openProjectWebview(context, project as any);
    }),
  );
}

// webview handling moved to `src/webviews/projectDetails.ts`

export function deactivate() {}
