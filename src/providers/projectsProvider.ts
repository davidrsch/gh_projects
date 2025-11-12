import * as vscode from 'vscode';
import pMap from 'p-map';
import { ProjectNode } from '../model';
import { findGitRepos, readGitRemotes, pickPreferred } from '../gitUtils';
import { fetchProjects, getGithubAccessToken, isGithubHostLike, parseRemote } from '../github';

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProjectNode | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private cache: Map<string, ProjectNode> = new Map();

  constructor(private output: vscode.OutputChannel) {}

  refresh() { this._onDidChangeTreeData.fire(); }

  getTreeItem(e: ProjectNode): vscode.TreeItem {
    const item = new vscode.TreeItem(e.title, vscode.TreeItemCollapsibleState.None);
    item.tooltip = `${e.url}\n[${e.owner}/${e.repo}] ${e.repoPath}`;
    const meta: string[] = [];
    if (e.number) meta.push(`#${e.number}`);
    if (typeof e.public === 'boolean') meta.push(e.public ? 'public' : 'private');
    if (e.ownerLogin) meta.push(`owner:${e.ownerLogin}`);
    if (typeof e.repoCount === 'number') meta.push(`repos:${e.repoCount}`);
    item.description = meta.join(' • ') || e.url;
    item.command = { command: 'ghProjects.openProject', title: 'Open Project', arguments: [e] };
    return item;
  }

  async getChildren(): Promise<ProjectNode[]> {
    const output = this.output;
    output.show(true);
    output.clear();
    output.appendLine('--- GitHub Projects scan start ---');

    const token = await getGithubAccessToken();
    if (!token) {
      output.appendLine('[auth] No GitHub token found.');
      return [];
    }

    const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [process.cwd()];
    let allRepos: string[] = [];
    for (const root of workspaceRoots) {
      allRepos = allRepos.concat(findGitRepos(root));
    }

    output.appendLine(`[scan] found ${allRepos.length} git repositories under workspace`);

    const unique = new Map<string, ProjectNode>();

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'Fetching GitHub projects...' }, async () => {
      const results = await pMap(allRepos, async (repoPath) => {
        output.appendLine(`\n[repo] ${repoPath}`);
        const remotes = readGitRemotes(repoPath);
        const preferred = pickPreferred(remotes);
        if (!preferred) return [] as ProjectNode[];

        const parsed = parseRemote(preferred.url);
        if (!parsed || !isGithubHostLike(parsed.host)) return [] as ProjectNode[];

        output.appendLine(`  [graphql] fetching projects for ${parsed.owner}/${parsed.repo}`);
        const projects = await fetchProjects(parsed.owner, parsed.repo, token, output);
        return projects.map(p => ({ ...p, repoPath }));
      }, { concurrency: 3 });

      for (const list of results) {
        for (const p of list) {
          if (!unique.has(p.id)) unique.set(p.id, p);
        }
      }
    });

    this.cache = unique;
    output.appendLine(`\n[summary] unique projects: ${unique.size}`);
    return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title));
  }
}
