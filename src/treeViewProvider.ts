import * as vscode from "vscode";
import messages, { isGhNotFound } from "./lib/messages";
import logger from "./lib/logger";
import { ProjectView, ProjectEntry } from "./lib/types";
import { ProjectService } from "./services/projectService";

export class ProjectsProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectItem | undefined | void
  > = new vscode.EventEmitter<ProjectItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private projects: ProjectEntry[] = [];
  constructor(private workspaceRoot: string | undefined, private projectService: ProjectService) {
  }

  refresh(): void {
    // Show progress while loading projects to give user feedback.
    this.loadProjectsWithProgress().then(() =>
      this._onDidChangeTreeData.fire()
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
            new ProjectItem(p, undefined, vscode.TreeItemCollapsibleState.None)
        )
      );
    }

    // Projects are not collapsible and do not expose repo children.
    return Promise.resolve([]);
  }

  private async loadProjects(): Promise<void> {
    if (!this.workspaceRoot) return;
    try {
      try {
        vscode.window.showInformationMessage(
          "ghProjects: scanning workspace for GitHub projects..."
        );
      } catch (e) { }

      const projects = await this.projectService.loadProjects(this.workspaceRoot);

      if (projects.length === 0) {
        vscode.window.showInformationMessage(
          `ghProjects: No GitHub Projects found for scanned repositories.`
        );
      }

      this.projects = projects;
    } catch (e) {
      const msg = String(e || "");
      try {
        vscode.window.showErrorMessage(
          `ghProjects: Failed to load projects: ${msg}`
        );
      } catch (e) { }
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
        }
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
      project
    ),
    // projects are not collapsible and do not expose a click command (no hover command title)
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None
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
