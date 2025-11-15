import * as vscode from "vscode";
import findGitRepos from "./treeView/findRepos";
import getRemotesForPath from "./treeView/getRemotes";
import getProjectsForReposArray from "./treeView/getProjects";
import uniqueProjectsFromResults from "./treeView/getUniqueProjects";
import ghClient from "./github/ghClient";
import messages, { isGhNotFound } from "./lib/messages";
import { ProjectView } from "./lib/types";
import promisePool from "./lib/promisePool";

export interface ProjectEntry {
  id: string;
  title?: string;
  shortDescription?: string | null;
  description?: string | null;
  url?: string;
  repos?: Array<{ owner?: string; name?: string; path?: string }>;
  views?: ProjectView[]; // optional views provided by project queries
  error?: any;
}

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectItem | undefined | void
  > = new vscode.EventEmitter<ProjectItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private projects: ProjectEntry[] = [];

  constructor(private workspaceRoot: string | undefined) {}

  refresh(): void {
    // Show progress while loading projects to give user feedback.
    this.loadProjectsWithProgress().then(() =>
      this._onDidChangeTreeData.fire(),
    );
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
    if (!this.workspaceRoot) return Promise.resolve([]);

    if (!element) {
      // Ensure load happens with progress on first-call / refresh cycle.
      return this.loadProjectsWithProgress().then(() =>
        this.projects.map(
          (p) =>
            new ProjectItem(p, undefined, vscode.TreeItemCollapsibleState.None),
        ),
      );
    }

    // Projects are not collapsible and do not expose repo children.
    return Promise.resolve([]);
  }

  private async loadProjects(): Promise<void> {
    if (!this.workspaceRoot) return;
    try {
      const maxDepth = vscode.workspace
        .getConfiguration("ghProjects")
        .get<number>("maxDepth", 4);
      const repos = await findGitRepos(this.workspaceRoot, maxDepth);
      console.debug("[ghProjects] Found repos:", repos);
      const items: any[] = [];
      const maxConcurrency = vscode.workspace
        .getConfiguration("ghProjects")
        .get<number>("maxConcurrency", 4);

      // Build tasks for fetching remotes in parallel
      const remoteTasks: Array<() => Promise<void>> = repos.map((r) => {
        return async () => {
          const remotes = await getRemotesForPath(r.path);
          items.push({ path: r.path, remotes });
        };
      });

      await promisePool<void>(remoteTasks, maxConcurrency);
      console.debug("[ghProjects] Repo items with remotes:", items);

      const projectQueries = await getProjectsForReposArray(items);
      console.debug("[ghProjects] Project queries result:", projectQueries);
      const unique = uniqueProjectsFromResults(projectQueries as any[]);
      console.debug("[ghProjects] Unique projects:", unique);
      // Preserve basic fields and then fetch `views` for each project by its id.
      interface RepoRef {
        owner?: string;
        name?: string;
        path?: string;
      }
      interface RepoWithRemotes {
        path: string;
        remotes: any[];
      }
      const mapped = (unique || []).map((p: any) => ({
        id: p.id || p.url || p.title || "<unknown>",
        title: p.title,
        shortDescription: p.shortDescription || null,
        description: p.description ?? null,
        url: p.url,
        repos: p.repos as RepoRef[] | undefined,
        views: undefined as ProjectView[] | undefined,
      }));
      console.debug("[ghProjects] Mapped projects:", mapped);

      // Fetch views with a concurrency-limited pool to improve throughput
      const CONCURRENCY = 4;
      const tasks: Array<() => Promise<ProjectView[]>> = mapped.map((proj) => {
        return async () => {
          if (!proj.id) return [] as ProjectView[];
          try {
            const v = await ghClient.fetchProjectViews(proj.id as string);
            return v || [];
          } catch (e) {
            // task-level error is considered non-fatal for views fetch – return empty views
            return [] as ProjectView[];
          }
        };
      });

      const res = await promisePool<ProjectView[]>(tasks, CONCURRENCY);
      for (let i = 0; i < mapped.length; i++) {
        mapped[i].views = Array.isArray(res[i]) ? res[i] : [];
      }
      console.debug("[ghProjects] Projects with views:", mapped);

      this.projects = mapped;
    } catch (e) {
      const msg = String(e || "");
      if (isGhNotFound(e)) {
        vscode.window.showErrorMessage(messages.GH_NOT_FOUND);
      } else {
        vscode.window.showErrorMessage(`Failed to load projects: ${msg}`);
      }
      this.projects = [];
    }
  }

  private async loadProjectsWithProgress(): Promise<void> {
    if (!this.workspaceRoot) return;
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Loading GitHub projects...",
        },
        async (progress) => {
          progress.report({ increment: 0 });
          await this.loadProjects();
          progress.report({ increment: 100 });
        },
      );
    } catch (e) {
      // loadProjects handles errors and sets this.projects, so nothing more needed here.
    }
  }
}

export class ProjectItem extends vscode.TreeItem {
  constructor(
    public readonly project: ProjectEntry,
    public readonly label: string = ((project) => project.title || project.id)(
      project,
    ),
    // projects are not collapsible and do not expose a click command (no hover command title)
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
    // Tooltip: show only the short description or label (no command title)
    this.tooltip = project.shortDescription || this.label;
    // Clicking a project opens the details webview
    this.command = {
      command: "ghProjects.openProject",
      title: "Open Project Details",
      arguments: [project],
    };
    this.contextValue = "project";
  }
}
