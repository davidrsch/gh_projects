import * as vscode from 'vscode';
import findGitRepos from './treeView/findRepos';
import getRemotesForPath from './treeView/getRemotes';
import getProjectsForReposArray from './treeView/getProjects';
import uniqueProjectsFromResults from './treeView/getUniqueProjects';
import ghClient from './github/ghClient';

export interface ProjectEntry {
  id: string;
  title?: string;
  shortDescription?: string | null;
  description?: string | null;
  url?: string;
  repos?: Array<{ owner?: string; name?: string; path?: string }>;
  views?: any[]; // optional views provided by project queries
  error?: any;
}

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | void> = new vscode.EventEmitter<ProjectItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | void> = this._onDidChangeTreeData.event;

  private projects: ProjectEntry[] = [];

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    this.loadProjects().then(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
    if (!this.workspaceRoot) return Promise.resolve([]);

    if (!element) {
      return this.loadProjects().then(() => this.projects.map(p => new ProjectItem(p, undefined, vscode.TreeItemCollapsibleState.None)));
    }

    // Projects are not collapsible and do not expose repo children.
    return Promise.resolve([]);
  }

  private async loadProjects(): Promise<void> {
    if (!this.workspaceRoot) return;
    try {
      const repos = await findGitRepos(this.workspaceRoot, 4);
      const items: any[] = [];
      for (const r of repos) {
        const remotes = await getRemotesForPath(r.path);
        items.push({ path: r.path, remotes });
      }

      const projectQueries = await getProjectsForReposArray(items);
      const unique = uniqueProjectsFromResults(projectQueries as any[]);
      // Preserve basic fields and then fetch `views` for each project by its id.
      const mapped = (unique || []).map((p: any) => ({
        id: p.id || p.url || p.title || '<unknown>',
        title: p.title,
        shortDescription: p.shortDescription || null,
        description: p.description ?? null,
        url: p.url,
        repos: p.repos,
        views: undefined as any,
      }));

      // Sequentially fetch views for each project that has an id (avoids rate/cli overload).
      for (const proj of mapped) {
        if (proj.id) {
          try {
            // ghClient.fetchProjectViews expects a GraphQL node ID (ProjectV2 id)
            const v = await ghClient.fetchProjectViews(proj.id as string);
            proj.views = v || [];
          } catch (e) {
            proj.views = [];
          }
        }
      }

      this.projects = mapped;
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load projects: ${String(e)}`);
      this.projects = [];
    }
  }
}

export class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly project: ProjectEntry,
    public readonly label: string = (project => project.title || project.id)(project),
    // projects are not collapsible and do not expose a click command (no hover command title)
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
    // Tooltip: show only the short description or label (no command title)
    this.tooltip = project.shortDescription || this.label;
    // Clicking a project opens the details webview
    this.command = {
      command: 'ghProjects.openProject',
      title: 'Open Project Details',
      arguments: [project],
    };
    this.contextValue = 'project';
  }
}
