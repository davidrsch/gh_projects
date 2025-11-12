import * as vscode from 'vscode';
import { ProjectsProvider } from './providers/projectsProvider';
import { openProjectWebview } from './webview';
import type { ProjectNode } from './model';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Github Projects');
  const provider = new ProjectsProvider(output);
  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('projects', provider),
    vscode.commands.registerCommand('ghProjects.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('ghProjects.openProject', (node: ProjectNode) => openProjectWebview(context, node))
  );
}

export function deactivate() {}
