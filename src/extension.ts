import * as vscode from 'vscode';
import { ProjectsProvider } from './providers/projectsProvider';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Github Projects');
  const provider = new ProjectsProvider(output);
  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('projects', provider),
    vscode.commands.registerCommand('ghProjects.refresh', () => provider.refresh())
  );
}

export function deactivate() {}
