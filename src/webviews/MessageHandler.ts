import * as vscode from "vscode";
import { ProjectEntry, ProjectView } from "../lib/types";
import { ProjectDataService } from "../services/ProjectDataService";
import { GitHubRepository } from "../services/GitHubRepository";
import logger from "../lib/logger";
import { wrapError } from "../lib/errors";
import messages, { isGhNotFound } from "../lib/messages";

// GitHub Pull Requests & Issues extension ID
const GITHUB_PR_EXTENSION_ID = "GitHub.vscode-pull-request-github";

export class MessageHandler {
  constructor(
    private panel: vscode.WebviewPanel,
    private project: ProjectEntry,
    private panelKey: string,
    private context: vscode.ExtensionContext,
    private resources: any, // Pass resources for re-init
  ) {}

  public attach() {
    this.panel.webview.onDidReceiveMessage(
      async (msg) => {
        await this.handleMessage(msg);
      },
      null,
      this.context.subscriptions,
    );
  }

  private async handleMessage(msg: any) {
    // Log all messages for debugging
    if (msg.command && msg.command.startsWith("test:")) {
      console.log("[Extension] Received test message:", msg);
    }

    // Special-case: the UI may send a 'ready' handshake when it has initialized.
    try {
      if (msg && typeof msg === "object" && msg.command === "ready") {
        this.sendInitMessage();
        return;
      }
    } catch (e) {}

    // Basic validation
    if (!msg || typeof msg !== "object" || typeof msg.command !== "string") {
      this.panel.webview.postMessage({
        command: "fields",
        viewKey:
          msg && (msg as any).viewKey ? String((msg as any).viewKey) : null,
        error: "Invalid message format",
        authRequired: false,
      });
      return;
    }

    // Some commands (like openUrl/openRepo/debugLog) are global and do not
    // require a specific viewKey. For all other commands, we only handle
    // messages that are explicitly targeted at this panel/view.
    const command = (msg as any).command as string;

    // Some commands (like openUrl/openRepo/debugLog) are global side effects
    // and do not require a specific viewKey. All data/update commands do.
    const requiresViewKey = ![
      "openUrl",
      "openRepo",
      "debugLog",
      "addItem:createIssue",
      "addItem:addFromRepo",
    ].includes(command);

    // Only handle view-scoped messages for this panel
    if (requiresViewKey && !msg?.viewKey) {
      return;
    }

    switch (msg.command) {
      case "openRepo":
        if (typeof (msg as any).path === "string") {
          vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(msg.path),
            { forceNewWindow: false },
          );
        }
        break;
      case "openUrl":
        if (typeof (msg as any).url === "string") {
          try {
            const u = vscode.Uri.parse(String((msg as any).url));
            try {
              // Prefer the generic vscode.open command so that other
              // extensions (like the official GitHub Pull Requests
              // extension) can participate in handling GitHub links.
              await vscode.commands.executeCommand("vscode.open", u);
            } catch (primaryError) {
              // Fallback to the default external browser behavior.
              await vscode.env.openExternal(u);
            }
          } catch (e) {
            const sanitized = String((e as any)?.message || e || "");
            logger.error("webview.openUrl failed: " + sanitized);
            vscode.window.showErrorMessage("Failed to open URL: " + sanitized);
          }
        }
        break;
      case "addItem:createIssue":
        await this.handleAddItemCreateIssue(msg);
        break;
      case "addItem:addFromRepo":
        await this.handleAddItemAddFromRepo(msg);
        break;
      case "requestFields":
        await this.handleRequestFields(msg);
        break;
      case "debugLog":
        this.handleDebugLog(msg);
        break;
      case "setViewFilter":
        await this.handleSetViewFilter(msg);
        break;
      case "discardViewFilter":
        await this.handleDiscardViewFilter(msg);
        break;
      case "setViewGrouping":
        await this.handleSetViewGrouping(msg);
        break;
      case "discardViewGrouping":
        await this.handleDiscardViewGrouping(msg);
        break;
      case "updateFieldValue":
        await this.handleUpdateFieldValue(msg);
        break;
    }
  }

  private async handleAddItemCreateIssue(msg: any) {
    try {
      // Get repositories linked to this project
      const repos = this.project.repos || [];

      // Build GitHub "new issue" URL for the first repository
      // The GitHub Pull Requests & Issues extension will intercept this URL
      // if installed, allowing issue creation within VS Code
      let targetUrl: string;

      if (repos.length > 0 && repos[0].owner && repos[0].name) {
        // Construct GitHub new issue URL: https://github.com/{owner}/{repo}/issues/new
        targetUrl = `https://github.com/${repos[0].owner}/${repos[0].name}/issues/new`;
      } else {
        // Fallback to project URL if no repos available
        targetUrl =
          (this.project && (this.project as any).url) ||
          "https://github.com/projects";
      }

      const uri = vscode.Uri.parse(targetUrl);
      try {
        // Use vscode.open to allow the GitHub extension to intercept the URL
        // This is the recommended approach for extension interoperability
        await vscode.commands.executeCommand("vscode.open", uri);
      } catch (primaryError) {
        // Fallback to opening in external browser
        await vscode.env.openExternal(uri);
      }
    } catch (e) {
      const sanitized = String((e as any)?.message || e || "");
      logger.error("webview.addItem:createIssue failed: " + sanitized);
    }
  }

  private async handleAddItemAddFromRepo(msg: any) {
    try {
      // Get repositories linked to this project
      const repos = this.project.repos || [];

      if (repos.length === 0) {
        vscode.window.showWarningMessage(
          "No repositories are linked to this project. Please add repositories to the project first.",
        );
        return;
      }

      // Step 1: Show repository picker
      const repoItems = repos.map((repo) => {
        const nameWithOwner =
          repo.owner && repo.name
            ? `${repo.owner}/${repo.name}`
            : repo.path || "Unknown repo";
        return {
          label: `$(repo) ${nameWithOwner}`,
          description: repo.path || "",
          owner: repo.owner,
          name: repo.name,
        };
      });

      const selectedRepo = await vscode.window.showQuickPick(repoItems, {
        placeHolder: "Select a repository",
        matchOnDescription: true,
      });

      if (!selectedRepo) {
        return; // User cancelled
      }

      // Validate owner and name
      if (!selectedRepo.owner || !selectedRepo.name) {
        vscode.window.showErrorMessage(
          "Invalid repository format. Expected owner/repository format.",
        );
        return;
      }
      const owner = selectedRepo.owner;
      const name = selectedRepo.name;

      // Step 2: Fetch issues and PRs from the selected repository
      const ghRepo = GitHubRepository.getInstance();

      // Show progress indicator while fetching
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Fetching issues and pull requests...",
          cancellable: false,
        },
        async () => {
          return await ghRepo.getOpenIssuesAndPullRequests(owner, name, 50);
        },
      );

      const { issues: allIssues, pullRequests: allPRs } = result;

      // Get existing items in the project to filter them out
      const getFilteredItems = async () => {
        try {
          const projectData = await ProjectDataService.getProjectData(
            this.project,
            msg.viewKey,
          );

          // Extract content IDs from existing project items
          const existingContentIds = new Set<string>(
            projectData.snapshot.items
              .filter((item) => item.content?.id)
              .map((item) => String(item.content.id)),
          );

          // Filter out items that are already in the project
          return {
            issues: allIssues.filter(
              (issue) => !existingContentIds.has(String(issue.id)),
            ),
            pullRequests: allPRs.filter(
              (pr) => !existingContentIds.has(String(pr.id)),
            ),
          };
        } catch (filterError) {
          logger.debug(
            `Failed to filter existing items for project ${this.project.id}: ${String(filterError)}`,
          );
          // Return unfiltered list if filtering fails
          return { issues: allIssues, pullRequests: allPRs };
        }
      };

      const { issues, pullRequests } = await getFilteredItems();

      // Step 3: Create quick pick items for issues and PRs
      const items: any[] = [];

      // Add issues
      if (issues.length > 0) {
        items.push({
          label: "Issues",
          kind: vscode.QuickPickItemKind.Separator,
        });

        for (const issue of issues) {
          items.push({
            label: `$(issue-opened) #${issue.number}: ${issue.title}`,
            description: issue.author?.login || "",
            detail: issue.repository?.nameWithOwner,
            contentId: issue.id,
            type: "issue",
          });
        }
      }

      // Add pull requests
      if (pullRequests.length > 0) {
        items.push({
          label: "Pull Requests",
          kind: vscode.QuickPickItemKind.Separator,
        });

        for (const pr of pullRequests) {
          items.push({
            label: `$(git-pull-request) #${pr.number}: ${pr.title}`,
            description: pr.author?.login || "",
            detail: pr.repository?.nameWithOwner,
            contentId: pr.id,
            type: "pr",
          });
        }
      }

      if (items.length === 0) {
        vscode.window.showInformationMessage(
          "No open issues or pull requests found that aren't already in the project.",
        );
        return;
      }

      // Step 4: Show picker for issues/PRs
      const selectedItem = await vscode.window.showQuickPick(items, {
        placeHolder: "Select an issue or pull request to add",
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selectedItem || !selectedItem.contentId) {
        return; // User cancelled or separator selected
      }

      // Step 5: Add the selected item to the project
      if (!this.project.id) {
        vscode.window.showErrorMessage("Project ID is missing");
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Adding item to project...",
          cancellable: false,
        },
        async () => {
          const addResult = await ghRepo.addItemToProject(
            this.project.id,
            selectedItem.contentId,
          );

          if (addResult.success) {
            vscode.window.showInformationMessage(
              `Successfully added ${selectedItem.type === "issue" ? "issue" : "PR"} to project`,
            );

            // Refresh the webview to show the new item
            try {
              const data = await ProjectDataService.getProjectData(
                this.project,
                msg.viewKey,
                true,
              );

              this.panel.webview.postMessage({
                command: "fields",
                viewKey: msg.viewKey,
                payload: data.snapshot,
                effectiveFilter: data.effectiveFilter,
              });
            } catch (refreshError) {
              logger.debug(
                "Failed to refresh after adding item: " + String(refreshError),
              );
            }
          } else {
            vscode.window.showErrorMessage(
              `Failed to add item to project: ${addResult.error || "Unknown error"}`,
            );
          }
        },
      );
    } catch (e) {
      const sanitized = String((e as any)?.message || e || "");
      logger.error("webview.addItem:addFromRepo failed: " + sanitized);
      vscode.window.showErrorMessage(`Failed to add item: ${sanitized}`);
    }
  }

  private async handleRequestFields(msg: any) {
    const reqViewKey = (msg as any).viewKey as string | undefined;
    // validate fields
    if (reqViewKey !== undefined && typeof reqViewKey !== "string") {
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: null,
        error: "Invalid requestFields: viewKey must be a string",
        authRequired: false,
      });
      return;
    }
    if (
      (msg as any).first !== undefined &&
      typeof (msg as any).first !== "number"
    ) {
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey ?? null,
        error: "Invalid requestFields: first must be a number",
        authRequired: false,
      });
      return;
    }
    const _reqMsg = `webview.requestFields received viewKey=${String(
      reqViewKey,
    )} projectId=${this.project.id}`;
    logger.debug(_reqMsg);
    try {
      const { snapshot, effectiveFilter, itemsCount } =
        await ProjectDataService.getProjectData(this.project, reqViewKey);

      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey,
        payload: snapshot,
        effectiveFilter: effectiveFilter,
        itemsCount: itemsCount,
      });
    } catch (e) {
      const wrapped = wrapError(e, "requestFields failed");
      const msgText = String(wrapped?.message || wrapped || "");
      logger.error("requestFields failed: " + msgText);
      if ((wrapped as any)?.code === "ENOENT" || isGhNotFound(wrapped)) {
        vscode.window.showErrorMessage(messages.GH_NOT_FOUND);
      }
      const isAuth = (wrapped as any)?.code === "ENOTAUTH";
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey,
        error: msgText,
        authRequired: Boolean(isAuth),
      });
    }
  }

  private handleDebugLog(msg: any) {
    try {
      let level = (msg as any).level || "debug";
      if (typeof level !== "string") level = "debug";
      level = (["debug", "info", "warn", "error"] as string[]).includes(level)
        ? level
        : "debug";
      const vk = (msg as any).viewKey
        ? ` viewKey=${String((msg as any).viewKey)}`
        : "";
      const text = String((msg as any).message || (msg as any).msg || "");
      const data =
        (msg as any).data !== undefined ? (msg as any).data : undefined;
      const formatted =
        `webview:${vk} ${text}` + (data ? ` ${JSON.stringify(data)}` : "");
      if (level === "info") logger.info(formatted);
      else if (level === "warn") logger.warn(formatted);
      else if (level === "error") logger.error(formatted);
      else logger.debug(formatted);
    } catch (e) {
      const fm = `webview.debugLog parse failed: ${String(e)}`;
      logger.debug(fm);
    }
  }

  private async handleSetViewFilter(msg: any) {
    try {
      const reqViewKey = (msg as any).viewKey as string | undefined;
      const newFilter = (msg as any).filter;
      if (!reqViewKey) return;
      const view = this.getViewFromKey(reqViewKey);

      // Update in-memory details.filter
      if (view) {
        if (!(view as any).details) (view as any).details = {};
        (view as any).details.filter =
          typeof newFilter === "string" ? newFilter : undefined;
      }
      // Persist saved filter to workspaceState so it survives reloads
      try {
        const storageKey = `viewFilter:${this.project.id}:${view && view.number}`;
        await this.context.workspaceState.update(
          storageKey,
          (view && (view as any).details && (view as any).details.filter) ||
            undefined,
        );
      } catch (e) {
        logger.debug("workspaceState.update failed: " + String(e));
      }

      const { snapshot, effectiveFilter } =
        await ProjectDataService.getProjectData(this.project, reqViewKey);

      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey,
        payload: snapshot,
        effectiveFilter: effectiveFilter,
      });
    } catch (e) {
      const wrapped = wrapError(e, "setViewFilter failed");
      const msgText = String(wrapped?.message || wrapped || "");
      logger.error("setViewFilter failed: " + msgText);
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: (msg as any).viewKey || null,
        error: msgText,
      });
    }
  }

  private async handleDiscardViewFilter(msg: any) {
    try {
      const reqViewKey = (msg as any).viewKey as string | undefined;
      if (!reqViewKey) return;
      const view = this.getViewFromKey(reqViewKey);

      // Restore the saved filter from workspaceState (if any), otherwise keep existing
      try {
        const storageKey = `viewFilter:${this.project.id}:${view && view.number}`;
        const saved = await this.context.workspaceState.get<string>(storageKey);
        if (typeof saved === "string") {
          if (!view)
            (this.project.views as any)[this.getViewIndex(reqViewKey)] = {}; // Should not happen if view found
          // Re-fetch view to be safe or just update
          if (view) {
            if (!(view as any).details) (view as any).details = {};
            (view as any).details.filter = saved;
          }
        }
      } catch (e) {
        // ignore
      }

      const { snapshot, effectiveFilter } =
        await ProjectDataService.getProjectData(this.project, reqViewKey);

      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey,
        payload: snapshot,
        effectiveFilter: effectiveFilter,
      });
    } catch (e) {
      const wrapped = wrapError(e, "discardViewFilter failed");
      const msgText = String(wrapped?.message || wrapped || "");
      logger.error("discardViewFilter failed: " + msgText);
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: (msg as any).viewKey || null,
        error: msgText,
      });
    }
  }

  private async handleSetViewGrouping(msg: any) {
    try {
      const reqViewKey = (msg as any).viewKey as string | undefined;
      const newGrouping = (msg as any).grouping;
      if (!reqViewKey) return;
      const view = this.getViewFromKey(reqViewKey);

      // Update in-memory details.groupByFields
      if (view) {
        if (!(view as any).details) (view as any).details = {};
        (view as any).details.groupByFields =
          typeof newGrouping === "string" && newGrouping
            ? { nodes: [{ name: newGrouping }] }
            : undefined;
      }
      // Persist saved grouping to workspaceState so it survives reloads
      try {
        const storageKey = `viewGrouping:${this.project.id}:${view && view.number}`;
        await this.context.workspaceState.update(
          storageKey,
          (view &&
            (view as any).details &&
            (view as any).details.groupByFields &&
            (view as any).details.groupByFields.nodes &&
            (view as any).details.groupByFields.nodes[0] &&
            (view as any).details.groupByFields.nodes[0].name) ||
            undefined,
        );
      } catch (e) {
        logger.debug("workspaceState.update (grouping) failed: " + String(e));
      }

      const { snapshot, effectiveFilter } =
        await ProjectDataService.getProjectData(this.project, reqViewKey);

      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey,
        payload: snapshot,
        effectiveFilter: effectiveFilter,
      });
    } catch (e) {
      const wrapped = wrapError(e, "setViewGrouping failed");
      const msgText = String(wrapped?.message || wrapped || "");
      logger.error("setViewGrouping failed: " + msgText);
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: (msg as any).viewKey || null,
        error: msgText,
      });
    }
  }

  private async handleDiscardViewGrouping(msg: any) {
    try {
      const reqViewKey = (msg as any).viewKey as string | undefined;
      if (!reqViewKey) return;
      const view = this.getViewFromKey(reqViewKey);

      // Restore the saved grouping from workspaceState (if any), otherwise keep existing
      try {
        const storageKey = `viewGrouping:${this.project.id}:${view && view.number}`;
        const saved = await this.context.workspaceState.get<string>(storageKey);
        if (typeof saved === "string") {
          if (view) {
            if (!(view as any).details) (view as any).details = {};
            (view as any).details.groupByFields = { nodes: [{ name: saved }] };
          }
        }
      } catch (e) {
        // ignore
      }

      const { snapshot, effectiveFilter } =
        await ProjectDataService.getProjectData(this.project, reqViewKey);

      this.panel.webview.postMessage({
        command: "fields",
        viewKey: reqViewKey,
        payload: snapshot,
        effectiveFilter: effectiveFilter,
      });
    } catch (e) {
      const wrapped = wrapError(e, "discardViewGrouping failed");
      const msgText = String(wrapped?.message || wrapped || "");
      logger.error("discardViewGrouping failed: " + msgText);
      this.panel.webview.postMessage({
        command: "fields",
        viewKey: (msg as any).viewKey || null,
        error: msgText,
      });
    }
  }

  private getViewIndex(viewKey: string): number {
    let localKey = String(viewKey).split(":").pop();
    let viewIdx = 0;
    if (localKey && localKey.startsWith("view-")) {
      const idx = Number(localKey.split("-")[1]);
      if (!isNaN(idx)) viewIdx = idx;
    }
    return viewIdx;
  }

  private getViewFromKey(viewKey: string): ProjectView | undefined {
    const viewIdx = this.getViewIndex(viewKey);
    const viewsArr: ProjectView[] = Array.isArray(this.project.views)
      ? this.project.views
      : [];
    return viewsArr[viewIdx];
  }

  private async handleUpdateFieldValue(msg: any) {
    try {
      const reqViewKey = (msg as any).viewKey as string | undefined;
      const messageId = (msg as any).id;
      const projectId = (msg as any).projectId || this.project.id;
      const itemId = (msg as any).itemId;
      const fieldId = (msg as any).fieldId;

      // Support both CellEditor (“newValue”) and tableViewFetcher (“value”) APIs
      const newValue =
        (msg as any).newValue !== undefined
          ? (msg as any).newValue
          : (msg as any).value;

      const fieldType = (msg as any).fieldType;

      if (!projectId || !itemId || !fieldId) {
        this.panel.webview.postMessage({
          command: "updateFieldValueResponse",
          id: messageId,
          success: false,
          error: "Missing required fields: projectId, itemId, or fieldId",
        });
        return;
      }

      logger.debug(
        `webview.updateFieldValue projectId=${projectId} itemId=${itemId} fieldId=${fieldId} type=${fieldType}`,
      );

      const { GitHubRepository } = await import("../services/GitHubRepository");
      const result = await GitHubRepository.getInstance().updateFieldValue(
        projectId,
        itemId,
        fieldId,
        newValue,
        fieldType,
      );

      if (result.success) {
        this.panel.webview.postMessage({
          command: "updateFieldValueResponse",
          id: messageId,
          success: true,
        });

        try {
          const data = await ProjectDataService.getProjectData(
            this.project,
            reqViewKey,
            true,
          );

          this.panel.webview.postMessage({
            command: "fields",
            viewKey: reqViewKey,
            payload: data.snapshot,
            effectiveFilter: data.effectiveFilter,
          });

          this.panel.webview.postMessage({
            command: "updateFieldValueResult",
            success: true,
            viewKey: reqViewKey,
            payload: data.snapshot,
            effectiveFilter: data.effectiveFilter,
          });
        } catch (e) {
          logger.debug("Failed to refresh after update: " + String(e));
        }
      } else {
        this.panel.webview.postMessage({
          command: "updateFieldValueResponse",
          id: messageId,
          success: false,
          error: result.error || "Update failed",
        });

        this.panel.webview.postMessage({
          command: "updateFieldValueResult",
          success: false,
          viewKey: reqViewKey,
          error: result.error || "Update failed",
        });
      }
    } catch (e) {
      const wrapped = wrapError(e, "updateFieldValue failed");
      const msgText = String(wrapped?.message || wrapped || "");
      logger.error("updateFieldValue failed: " + msgText);

      this.panel.webview.postMessage({
        command: "updateFieldValueResponse",
        id: (msg as any).id,
        success: false,
        error: msgText,
      });

      this.panel.webview.postMessage({
        command: "updateFieldValueResult",
        success: false,
        viewKey: (msg as any).viewKey || null,
        error: msgText,
      });
    }
  }

  private sendInitMessage() {
    try {
      const resend = {
        command: "init",
        project: {
          title: this.project.title,
          repos: this.project.repos ?? [],
          views: Array.isArray(this.project.views) ? this.project.views : [],
          description: this.project.description ?? "",
          panelKey: this.panelKey,
        },
        panelKey: this.panelKey,
        resources: {
          overview: this.resources.fetcherUris.overviewUri?.toString(),
          table: this.resources.fetcherUris.tableUri?.toString(),
          helper: this.resources.fetcherUris.helperUri?.toString(),
          board: this.resources.fetcherUris.boardUri?.toString(),
          roadmap: this.resources.fetcherUris.roadmapUri?.toString(),
          content: this.resources.fetcherUris.contentUri?.toString(),
          patch: this.resources.fetcherUris.patchUri?.toString(),
          elements: this.resources.elementsUri?.toString(),
        },
      };
      this.panel.webview.postMessage(resend);
    } catch (e) {}
  }
}
