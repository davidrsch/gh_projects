import * as vscode from 'vscode';
import { ProjectsProvider } from './providers/projectsProvider';
import { openProjectWebview } from './webview';
import type { ProjectNode } from './model';
import { fetchTableMeta, fetchTableItems } from './github/tables';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Github Projects');
  const provider = new ProjectsProvider(output);
  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('projects', provider),
    vscode.commands.registerCommand('ghProjects.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('ghProjects.openProject', (node: ProjectNode) => openProjectWebview(context, node)),
    vscode.commands.registerCommand('ghProjects.testTableQueries', async (node?: ProjectNode) => {
      try {
        let project = node as ProjectNode | undefined;
        if (!project) {
          // Try to use cached projects; if empty, refresh
          let projects = provider.getCachedProjects();
          if (!projects || projects.length === 0) {
            projects = await provider.getChildren();
          }
          if (!projects || projects.length === 0) {
            vscode.window.showWarningMessage('No GitHub Projects found in the workspace. Try refresh first.');
            return;
          }
          const pick = await vscode.window.showQuickPick(
            projects.map(p => ({
              label: p.title,
              description: `${p.owner}/${p.repo}`,
              detail: p.url,
              project: p,
            })),
            { placeHolder: 'Select a project to test project table queries' }
          );
          if (!pick) return;
          project = (pick as any).project as ProjectNode;
        }

        const session = await vscode.authentication.getSession('github', ['repo', 'read:project'], { createIfNone: true });
        const token = session?.accessToken;
        if (!token) {
          vscode.window.showErrorMessage('Missing GitHub token for testing queries.');
          return;
        }

        output.appendLine(`[test] Project: ${project.title} (${project.owner}/${project.repo})`);
        const views = project.views ?? [];
        if (views.length === 0) {
          output.appendLine('[test] No views found on this project.');
          return;
        }

        for (const v of views) {
          try {
            output.appendLine(`[test] Fetch meta for view #${v.number} (${v.name})...`);
            const meta = await fetchTableMeta(project.id, v.number, token);
            output.appendLine(`[test]  layout=${meta.layout} filter=${meta.filter ?? '—'} columns=${meta.visibleFieldIds.length}`);
            if (meta.layout === 'TABLE') {
              const page = await fetchTableItems(project.id, meta, token);
              output.appendLine(`[test]  items=${page.items.length} hasNextPage=${page.pageInfo.hasNextPage}`);
            } else {
              output.appendLine('[test]  Skipped items fetch (not a TABLE view).');
            }
          } catch (err: any) {
            output.appendLine(`[test:error] View #${v.number} (${v.name}): ${err?.message ?? String(err)}`);
          }
        }

        vscode.window.showInformationMessage('GitHub Projects table queries test completed. See "Github Projects" output.');
      } catch (err: any) {
        output.appendLine(`[test:fatal] ${err?.message ?? String(err)}`);
        vscode.window.showErrorMessage('Failed to run table queries test. See output for details.');
      }
    })
  );
}

export function deactivate() {}
