import * as vscode from "vscode";
import { ProjectEntry, ProjectView } from "../lib/types";
import { ProjectDataService } from "../services/ProjectDataService";
import { GitHubRepository } from "../services/GitHubRepository";
import logger from "../lib/logger";
import { wrapError } from "../lib/errors";
import messages, { isGhNotFound } from "../lib/messages";

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
      case "openUrlExternal":
        // Use vscode.env.openExternal to force opening in the default system browser
        const urlToOpen = (msg as any).url;
        logger.info(
          `[MessageHandler] openUrlExternal called with: ${urlToOpen}`,
        );
        if (urlToOpen) {
          try {
            await vscode.env.openExternal(vscode.Uri.parse(urlToOpen));
            logger.info(`[MessageHandler] openExternal success`);
          } catch (e) {
            logger.error(`[MessageHandler] openExternal failed: ${e}`);
            vscode.window.showErrorMessage(`Failed to open URL: ${urlToOpen}`);
          }
        } else {
          logger.error(`[MessageHandler] openUrlExternal missing URL`);
        }
        break;
      case "openUrl":
        await this.handleOpenUrl(msg);
        break;
      case "addItem:createIssue":
        await this.handleAddItemCreateIssue(msg);
        break;
      case "addItem:addFromRepo":
        await this.handleAddItemAddFromRepo(msg);
        break;
      case "moveItem":
        await this.handleMoveItem(msg);
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

  private async handleOpenUrl(msg: any) {
    if (typeof (msg as any).url !== "string") return;

    const urlString = String((msg as any).url);
    logger.info(`[handleOpenUrl] Requested to open: ${urlString}`);
    try {
      let uriToOpen = vscode.Uri.parse(urlString);

      // Attempt to resolve to a local file URI if it matches a workspace repository
      // This helps the GitHub extension identify the context and open the issue/PR within VS Code
      if (
        ((msg as any).tryExtension || urlString.includes("github.com")) &&
        vscode.workspace &&
        vscode.workspace.workspaceFolders
      ) {
        try {
          // Helper to clean URL using Regex (reused logic)
          const getSlugFromUrl = (url: string): string | null => {
            try {
              const regex =
                /(?:git@|https:\/\/|http:\/\/|ssh:\/\/|git:\/\/)(?:.*@)?github\.com[:\/]([^\/]+)\/([^\/.]+)(?:\.git)?/i;
              const match = url.match(regex);
              if (match && match.length >= 3) {
                return `${match[1]}/${match[2]}`.toLowerCase();
              }
              return null;
            } catch (e) {
              return null;
            }
          };

          const targetSlug = getSlugFromUrl(urlString);
          if (targetSlug) {
            const gitExtension =
              vscode.extensions &&
              vscode.extensions.getExtension<any>("vscode.git");
            if (gitExtension) {
              const git = gitExtension.isActive
                ? gitExtension.exports.getAPI(1)
                : await gitExtension.activate().then((ext) => ext.getAPI(1));

              if (git && git.repositories) {
                for (const local of git.repositories) {
                  const remote =
                    local.state.remotes?.find(
                      (r: any) => r.name === "origin",
                    ) || local.state.remotes?.[0];
                  if (remote && remote.fetchUrl) {
                    const localSlug = getSlugFromUrl(remote.fetchUrl);
                    if (localSlug === targetSlug) {
                      logger.info(
                        `[handleOpenUrl] Matched URL to local repo: ${local.rootUri.fsPath}`,
                      );
                      // We found the local repo!
                      // The GitHub extension often works better if we pass the *same* generic URL
                      // BUT make sure we have focus or context.
                      // Actually, vscode.open(uri) with a http URI is just generic.
                      // To force the GitHub extension to take it, strictly speaking it should just work if the extension is active.
                      // However, the user reports it failing.
                      // Let's try to verify if there is a way to trigger via command.
                      // Since we can't find a specific command, we will stick to vscode.open but ensue we activate the extension first.
                      // But we ALREADY do that.
                      // HYPOTHESIS: exact URL mismatch?
                      // Try opening the issue/PR using the specific issue/pr command if we can parse it.

                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (resolveErr) {
          logger.warn(
            `[handleOpenUrl] Failed to resolve local repo: ${resolveErr}`,
          );
        }
      }

      // If specific instruction to try extension (or just generally for GitHub URLs)
      if ((msg as any).tryExtension || urlString.includes("github.com")) {
        try {
          const ghExtension =
            vscode.extensions &&
            vscode.extensions.getExtension("github.vscode-pull-request-github");
          if (ghExtension) {
            if (!ghExtension.isActive) {
              await ghExtension.activate();
              logger.info(`[handleOpenUrl] Activated GitHub extension.`);
            }

            // Wait a tick for activation to settle
            await new Promise((r) => setTimeout(r, 500));
          }

          // Use the GitHub extension's URI handler to open issues/PRs
          // Format: vscode://github.vscode-pull-request-github/open-issue-webview?{"owner":"...","repo":"...","issueNumber":123}
          // Parse owner/repo/number from the GitHub URL
          const ghUrlMatch = urlString.match(
            /github\.com\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/,
          );

          if (ghUrlMatch) {
            const [, owner, repo, type, numberStr] = ghUrlMatch;
            const number = parseInt(numberStr, 10);

            logger.info(
              `[handleOpenUrl] Parsed GitHub URL: owner=${owner}, repo=${repo}, type=${type}, number=${number}`,
            );

            try {
              let handlerUri: vscode.Uri;

              if (type === "issues") {
                // Construct issue URI
                const query = JSON.stringify({
                  owner,
                  repo,
                  issueNumber: number,
                });
                handlerUri = vscode.Uri.from({
                  scheme: vscode.env.uriScheme,
                  authority: "github.vscode-pull-request-github",
                  path: "/open-issue-webview",
                  query,
                });

                logger.info(
                  `[handleOpenUrl] Constructed vscode URI: ${handlerUri.toString()}`,
                );

                // Open using vscode.env.openExternal which triggers the extension's UriHandler
                const opened = await vscode.env.openExternal(handlerUri);
                if (opened) {
                  logger.info(
                    `[handleOpenUrl] openExternal completed successfully.`,
                  );
                  return;
                } else {
                  logger.warn(
                    `[handleOpenUrl] openExternal returned false. Falling back to browser.`,
                  );
                }
              } else {
                // Construct PR URI with additional context to help extension avoid null reference errors
                const query = JSON.stringify({
                  owner,
                  repo,
                  pullRequestNumber: number,
                  number: number, // Fallback
                  url: urlString, // Original URL for full context
                });
                handlerUri = vscode.Uri.from({
                  scheme: vscode.env.uriScheme,
                  authority: "github.vscode-pull-request-github",
                  path: "/open-pull-request-webview",
                  query,
                });
              }

              logger.info(
                `[handleOpenUrl] Constructed vscode URI: ${handlerUri.toString()}`,
              );

              // Open using vscode.env.openExternal which triggers the extension's UriHandler
              const opened = await vscode.env.openExternal(handlerUri);
              if (opened) {
                logger.info(
                  `[handleOpenUrl] openExternal completed successfully.`,
                );
                return;
              } else {
                logger.warn(
                  `[handleOpenUrl] openExternal returned false. Falling back to browser.`,
                );
              }
            } catch (uriErr) {
              logger.warn(
                `[handleOpenUrl] URI handler failed: ${uriErr}. Falling back to browser.`,
              );
            }
          }
        } catch (e) {
          logger.error(`[handleOpenUrl] Error activating extension: ${e}`);
        }
      }

      // Fallback: open in browser
      try {
        logger.info(
          `[handleOpenUrl] Opening in browser: ${uriToOpen.toString()}`,
        );
        await vscode.env.openExternal(uriToOpen);
        logger.info(`[handleOpenUrl] Browser open completed.`);
      } catch (browserError) {
        logger.error(
          `[handleOpenUrl] Failed to open in browser: ${browserError}`,
        );
      }
    } catch (e) {
      const sanitized = String((e as any)?.message || e || "");
      logger.error("webview.openUrl failed: " + sanitized);
      vscode.window.showErrorMessage("Failed to open URL: " + sanitized);
    }
  }

  private async handleAddItemCreateIssue(msg: any) {
    try {
      // Map to store exact Uri objects to avoid fsPath roundtrip issues
      const repoUriMap = new Map<string, vscode.Uri>();
      // Map to store match type: 'strict' (safe for extension) or 'redirect' (needs fix)
      const repoMatchType = new Map<string, "strict" | "redirect">();
      // Map to store the actual Git Repository object for fixing remotes
      const repoGitMap = new Map<string, any>();

      // Get repositories linked to this project
      const repos = this.project.repos || [];

      // Attempt to resolve local paths for repositories using VS Code Git Extension
      try {
        const gitExtension = vscode.extensions.getExtension<any>("vscode.git");
        if (gitExtension) {
          const git = gitExtension.isActive
            ? gitExtension.exports.getAPI(1)
            : await gitExtension.activate().then((ext) => ext.getAPI(1));

          if (git && git.repositories) {
            const localRepos = git.repositories;
            const projectRepoSlugs = new Set(
              repos
                .map((r) =>
                  r.owner && r.name
                    ? `${r.owner}/${r.name}`.toLowerCase()
                    : null,
                )
                .filter(Boolean),
            );

            // Helper to clean URL using Regex
            const getSlugFromUrl = (url: string): string | null => {
              try {
                // Regex handles:
                // - git@github.com:owner/repo.git
                // - https://github.com/owner/repo.git
                // - ssh://git@github.com/owner/repo
                // - git://github.com/owner/repo
                // Capture groups: 1=Owner, 2=Name
                const regex =
                  /(?:git@|https:\/\/|http:\/\/|ssh:\/\/|git:\/\/)(?:.*@)?github\.com[:\/]([^\/]+)\/([^\/.]+)(?:\.git)?/i;
                const match = url.match(regex);
                if (match && match.length >= 3) {
                  return `${match[1]}/${match[2]}`.toLowerCase();
                }
                logger.debug(`[PathRes] Failed to parse slug from: ${url}`);
                return null;
              } catch (e) {
                logger.debug(`[PathRes] Error parsing slug: ${e}`);
                return null;
              }
            };

            for (const local of localRepos) {
              // Determine the "slug" for this local repo
              let localSlug: string | null = null;
              const remote =
                local.state.remotes?.find((r: any) => r.name === "origin") ||
                local.state.remotes?.[0];
              if (!remote) continue;

              const fetchUrl = remote.fetchUrl || "";
              localSlug = getSlugFromUrl(fetchUrl);

              logger.debug(
                `[PathRes] Checking local repo: ${local.rootUri.fsPath}`,
              );
              logger.debug(
                `[PathRes] Remote URL: ${fetchUrl} -> Slug: ${localSlug}`,
              );

              // Strategy 1: Direct String Match
              if (localSlug && projectRepoSlugs.has(localSlug)) {
                // Match found! Assign path to the corresponding project repo
                const matchingProjectRepo = repos.find(
                  (r) => `${r.owner}/${r.name}`.toLowerCase() === localSlug,
                );
                if (matchingProjectRepo) {
                  matchingProjectRepo.path = local.rootUri.fsPath;
                  const key =
                    `${matchingProjectRepo.owner}/${matchingProjectRepo.name}`.toLowerCase();
                  repoUriMap.set(key, local.rootUri);
                  repoMatchType.set(key, "strict");
                  repoGitMap.set(key, local);
                  logger.debug(
                    `[PathRes] STRICT MATCH: ${matchingProjectRepo.owner}/${matchingProjectRepo.name} -> ${matchingProjectRepo.path}`,
                  );
                }
                continue;
              }

              logger.debug(
                `[PathRes] No strict match for ${localSlug}. Checking API for redirects...`,
              );

              // Strategy 2: API Resolution (for renames/redirects)
              // If localSlug is valid but didn't match, maybe it's an old name?
              if (localSlug) {
                const [owner, name] = localSlug.split("/");
                if (owner && name) {
                  try {
                    const canonical =
                      await GitHubRepository.getInstance().getRepoCanonicalName(
                        owner,
                        name,
                      );
                    logger.debug(
                      `[PathRes] API Resolution: ${localSlug} canonical is ${canonical}`,
                    );
                    if (
                      canonical &&
                      projectRepoSlugs.has(canonical.toLowerCase())
                    ) {
                      const matchingProjectRepo = repos.find(
                        (r) =>
                          `${r.owner}/${r.name}`.toLowerCase() ===
                          canonical.toLowerCase(),
                      );
                      if (matchingProjectRepo) {
                        matchingProjectRepo.path = local.rootUri.fsPath;
                        const key =
                          `${matchingProjectRepo.owner}/${matchingProjectRepo.name}`.toLowerCase();
                        repoUriMap.set(key, local.rootUri);
                        repoMatchType.set(key, "redirect");
                        repoGitMap.set(key, local);
                        logger.debug(
                          `[PathRes] REDIRECT MATCH: ${matchingProjectRepo.owner}/${matchingProjectRepo.name} (from ${localSlug}) -> ${matchingProjectRepo.path}`,
                        );
                      }
                    }
                  } catch (e) {
                    logger.warn(
                      `Failed to resolve canonical name for local repo ${localSlug}: ${e}`,
                    );
                  }
                }
              }
            }
          }
        }
      } catch (gitErr) {
        logger.warn(
          "Failed to resolve local git repositories: " + String(gitErr),
        );
      }

      if (repos.length === 0) {
        // Fallback to project URL if no repos available
        const targetUrl = this.project?.url || "https://github.com/projects";
        const uri = vscode.Uri.parse(targetUrl);
        await vscode.env.openExternal(uri);
        return;
      }

      let selectedRepoConfig:
        | { owner?: string; name?: string; path?: string }
        | undefined;

      if (repos.length === 1) {
        selectedRepoConfig = repos[0];
      } else {
        // Show picker
        const items = repos.map((r) => {
          const label =
            r.owner && r.name ? `${r.owner}/${r.name}` : r.path || "Unknown";

          let desc = "Remote Repository (Browser only)";
          if (r.path) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(
              vscode.Uri.file(r.path),
            );
            const key =
              r.owner && r.name ? `${r.owner}/${r.name}`.toLowerCase() : "";
            const type = repoMatchType.get(key);
            const typeLabel =
              type === "strict"
                ? "Strict"
                : type === "redirect"
                  ? "Redirect"
                  : "Unknown";

            desc = `$(folder) ${workspaceFolder ? workspaceFolder.name : r.path} [${typeLabel}]`;
          }

          return {
            label: `$(repo) ${label}`,
            description: desc,
            repo: r,
          };
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select repository to create issue in",
        });

        if (!selected) return;
        selectedRepoConfig = selected.repo;
      }

      if (!selectedRepoConfig) return;

      // ALWAYS try the extension first if available
      let extensionSucceeded = false;
      const ghExtension = vscode.extensions.getExtension(
        "github.vscode-pull-request-github",
      );

      if (ghExtension) {
        try {
          if (!ghExtension.isActive) {
            await ghExtension.activate();
          }

          // Try to invoke issue.createIssue
          // The command uses active editor context, so we try to help by providing a URI
          const repoKey =
            selectedRepoConfig.owner && selectedRepoConfig.name
              ? `${selectedRepoConfig.owner}/${selectedRepoConfig.name}`.toLowerCase()
              : "";
          const uri =
            repoUriMap.get(repoKey) ||
            (selectedRepoConfig.path
              ? vscode.Uri.file(selectedRepoConfig.path)
              : undefined);

          // Set up a listener to auto-fill the project field when NewIssue.md opens
          const projectTitle = this.project?.title;
          let disposable: vscode.Disposable | undefined;

          if (projectTitle) {
            disposable = vscode.window.onDidChangeActiveTextEditor(
              async (editor) => {
                if (editor && editor.document.uri.scheme === "newissue") {
                  // Found the NewIssue.md file, edit the Projects line
                  try {
                    const document = editor.document;
                    const text = document.getText();

                    // Find the "Projects:" line and add the project title
                    // The line format is: "Projects: " (may have trailing space)
                    const projectsLineMatch = text.match(/^(Projects:\s*)$/m);
                    if (projectsLineMatch) {
                      const lineIndex =
                        text
                          .substring(0, text.indexOf(projectsLineMatch[0]))
                          .split("\n").length - 1;
                      const line = document.lineAt(lineIndex);

                      const edit = new vscode.WorkspaceEdit();
                      edit.replace(
                        document.uri,
                        new vscode.Range(line.range.start, line.range.end),
                        `Projects: ${projectTitle}`,
                      );
                      await vscode.workspace.applyEdit(edit);
                      logger.info(
                        `[handleAddItemCreateIssue] Auto-filled project: ${projectTitle}`,
                      );
                    }
                  } catch (editErr) {
                    logger.warn(
                      `[handleAddItemCreateIssue] Failed to auto-fill project: ${editErr}`,
                    );
                  } finally {
                    // Clean up listener after first use
                    if (disposable) {
                      disposable.dispose();
                    }
                  }
                }
              },
            );

            // Auto-cleanup after 10 seconds if file never opens
            setTimeout(() => {
              if (disposable) {
                disposable.dispose();
              }
            }, 10000);
          }

          logger.info(
            `[handleAddItemCreateIssue] Attempting issue.createIssue via extension${uri ? ` with URI: ${uri.toString()}` : ""}`,
          );
          await vscode.commands.executeCommand("issue.createIssue", uri);
          extensionSucceeded = true;
          logger.info(
            `[handleAddItemCreateIssue] Extension command succeeded.`,
          );
          return;
        } catch (cmdErr) {
          logger.warn(
            `[handleAddItemCreateIssue] Extension command failed: ${cmdErr}. Falling back to browser.`,
          );
        }
      } else {
        logger.info(
          `[handleAddItemCreateIssue] GitHub extension not installed. Using browser.`,
        );
      }

      // Fallback: Build GitHub "new issue" URL with PROJECT PRE-FILLED
      if (!extensionSucceeded) {
        let targetUrl: string;
        if (selectedRepoConfig.owner && selectedRepoConfig.name) {
          const baseUrl = `https://github.com/${selectedRepoConfig.owner}/${selectedRepoConfig.name}/issues/new`;

          // Extract project owner and number from project URL
          // Format: https://github.com/users/{owner}/projects/{number}
          // OR: https://github.com/orgs/{org}/projects/{number}
          const projectUrl = this.project?.url || "";
          const projectMatch = projectUrl.match(
            /github\.com\/(?:users|orgs)\/([^\/]+)\/projects\/(\d+)/,
          );

          if (projectMatch) {
            const [, projectOwner, projectNumber] = projectMatch;
            // Format: projects=owner/projectNumber
            const params = new URLSearchParams();
            params.set("projects", `${projectOwner}/${projectNumber}`);
            targetUrl = `${baseUrl}?${params.toString()}`;
            logger.info(
              `[handleAddItemCreateIssue] Opening browser with project pre-filled: ${targetUrl}`,
            );
          } else {
            targetUrl = baseUrl;
            logger.info(
              `[handleAddItemCreateIssue] Could not parse project URL, opening without pre-fill: ${projectUrl}`,
            );
          }
        } else {
          targetUrl = this.project?.url || "https://github.com/projects";
        }

        const uri = vscode.Uri.parse(targetUrl);
        await vscode.env.openExternal(uri);
      }
    } catch (e) {
      const sanitized = String((e as any)?.message || e || "");
      logger.error("webview.addItem:createIssue failed: " + sanitized);
    }
  }

  private getWorkspaceOrFsPath(uri: vscode.Uri): string {
    const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
    return wsFolder ? wsFolder.uri.fsPath : uri.fsPath;
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
            // If this was launched from a specific board column, attempt to
            // set the column field value on the newly created project item so
            // it appears in the expected column immediately.
            if (addResult.itemId) {
              await this.applyInitialBoardColumn(msg, addResult.itemId);
            }

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
      vscode.window.showErrorMessage(`Failed to add item: ${sanitized}`);
    }
  }

  /**
   * When an item is added from the Boards view, the client can pass
   * columnFieldId/columnValueId describing the column from which the
   * "+ Add item" action was launched. Use this information to set the
   * corresponding project field value on the new item so that it lands in
   * the expected column immediately.
   *
   * This is a best-effort helper: any errors are logged but do not surface
   * to the user or block the add-item flow.
   */
  private async applyInitialBoardColumn(msg: any, itemId: string) {
    try {
      const projectId = this.project && this.project.id;
      const columnFieldId = msg && msg.columnFieldId;
      const columnValueId = msg && msg.columnValueId;

      if (!projectId || !columnFieldId || !columnValueId) {
        return;
      }

      // Fetch project snapshot so we can determine the field data type
      const data = await ProjectDataService.getProjectData(
        this.project,
        msg.viewKey,
      );

      const snapshot: any = data && data.snapshot ? data.snapshot : {};
      const fields: any[] =
        (Array.isArray((snapshot as any).allFields)
          ? (snapshot as any).allFields
          : []) ||
        (Array.isArray((snapshot as any).fields)
          ? (snapshot as any).fields
          : []);

      const field = fields.find((f: any) => {
        const fid = String(f && f.id);
        const fName = String((f && f.name) || "").toLowerCase();
        return (
          (columnFieldId && String(columnFieldId) === fid) ||
          (msg.columnFieldName &&
            String(msg.columnFieldName).toLowerCase() === fName)
        );
      });

      if (!field) {
        logger.debug(
          `[applyInitialBoardColumn] Column field not found for project ${projectId} and fieldId=${columnFieldId}`,
        );
        return;
      }

      const dataType = String(field.dataType || "").toLowerCase();
      if (dataType !== "single_select" && dataType !== "iteration") {
        logger.debug(
          `[applyInitialBoardColumn] Unsupported column field type '${dataType}' for fieldId=${columnFieldId}`,
        );
        return;
      }

      const ghRepo = GitHubRepository.getInstance();
      const updateResult = await ghRepo.updateFieldValue(
        projectId,
        itemId,
        String(columnFieldId),
        String(columnValueId),
        dataType,
      );

      if (!updateResult || !updateResult.success) {
        logger.warn(
          `[applyInitialBoardColumn] Failed to set initial column value for item ${itemId}: ${
            (updateResult && updateResult.error) || "unknown error"
          }`,
        );
      } else {
        logger.info(
          `[applyInitialBoardColumn] Set initial column value for item ${itemId} (fieldId=${columnFieldId}, valueId=${columnValueId}, type=${dataType})`,
        );
      }
    } catch (e) {
      logger.warn(
        `[applyInitialBoardColumn] Unexpected error while setting initial column value: ${String(
          (e as any)?.message || e,
        )}`,
      );
    }
  }

  private async handleMoveItem(msg: any) {
    try {
      logger.debug(`[handleMoveItem] Received: ${JSON.stringify(msg)}`);
      const { itemId, projectId, fieldId, options, currentValue } = msg;

      if (
        !itemId ||
        !projectId ||
        !fieldId ||
        !options ||
        !Array.isArray(options)
      ) {
        logger.error(
          `[handleMoveItem] Invalid arguments: ${JSON.stringify(msg)}`,
        );
        return;
      }

      // Show QuickPick
      const items = options.map((opt: any) => {
        // Add indicator for current value?
        const isCurrent = opt.id === currentValue || opt.name === currentValue;

        // Debug color normalization
        const normalized = normalizeColor(opt.color) || "#848d97"; // Default to gray
        logger.debug(
          `[handleMoveItem] Option ${opt.name}: rawColor=${opt.color}, normalized=${normalized}`,
        );

        // Map color to ThemeIcon
        const iconPath = getIconForColor(normalized);

        return {
          label: opt.name,
          description: opt.description || "",
          detail: isCurrent ? "(Current)" : undefined,
          iconPath: iconPath,
          option: opt,
        };
      });

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select column to move item to",
      });

      if (!selected) return;

      const option = selected.option;
      logger.info(
        `[handleMoveItem] Selected option: ${option.name} (${option.id})`,
      );

      // Update field value
      const isIteration = option.startDate !== undefined;
      const type = isIteration ? "iteration" : "single_select";
      const value = option.id;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Moving item to ${option.name}...`,
        },
        async () => {
          const res = await GitHubRepository.getInstance().updateFieldValue(
            projectId,
            itemId,
            fieldId,
            value,
            type,
          );

          if (!res.success) {
            throw new Error(res.error);
          }

          // Refresh
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
        },
      );
    } catch (e: any) {
      const msgStr = e.message || String(e);
      logger.error(`[handleMoveItem] Failed: ${msgStr}`);
      vscode.window.showErrorMessage(`Failed to move item: ${msgStr}`);
    }
  }

  private async handleRequestFields(msg: any) {
    const reqViewKey = (msg as any).viewKey as string | undefined;
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

      if (snapshot.project.repos) {
        this.project.repos = snapshot.project.repos;
      }

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

      if (view) {
        if (!(view as any).details) (view as any).details = {};
        (view as any).details.filter =
          typeof newFilter === "string" ? newFilter : undefined;
      }
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

      try {
        const storageKey = `viewFilter:${this.project.id}:${view && view.number}`;
        const saved = await this.context.workspaceState.get<string>(storageKey);
        if (typeof saved === "string") {
          if (!view)
            (this.project.views as any)[this.getViewIndex(reqViewKey)] = {};
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

      if (view) {
        if (!(view as any).details) (view as any).details = {};
        (view as any).details.groupByFields =
          typeof newGrouping === "string" && newGrouping
            ? { nodes: [{ name: newGrouping }] }
            : undefined;
      }
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
      const startTime = Date.now();
      const reqViewKey = (msg as any).viewKey as string | undefined;
      const messageId = (msg as any).id;
      const projectId = (msg as any).projectId || this.project.id;
      const itemId = (msg as any).itemId;
      const fieldId = (msg as any).fieldId;

      const newValue =
        (msg as any).newValue !== undefined
          ? (msg as any).newValue
          : (msg as any).value;

      const fieldType = (msg as any).fieldType;

      if (!projectId || !itemId || !fieldId) {
        logger.info(
          `updateFieldValue missing fields projectId=${projectId} itemId=${itemId} fieldId=${fieldId} id=${messageId}`,
        );
        this.panel.webview.postMessage({
          command: "updateFieldValueResponse",
          id: messageId,
          success: false,
          error: "Missing required fields: projectId, itemId, or fieldId",
        });
        return;
      }

      logger.info(
        `webview.updateFieldValue received id=${messageId} projectId=${projectId} itemId=${itemId} fieldId=${fieldId} type=${fieldType} viewKey=${reqViewKey}`,
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
        logger.info(
          `updateFieldValue mutation success id=${messageId} fieldId=${fieldId} itemId=${itemId}`,
        );
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

          const elapsed = Date.now() - startTime;
          logger.info(
            `updateFieldValue completed id=${messageId} fieldId=${fieldId} elapsed_ms=${elapsed}`,
          );
        } catch (e) {
          logger.debug("Failed to refresh after update: " + String(e));
          const elapsed = Date.now() - startTime;
          logger.info(
            `updateFieldValue refresh failed id=${messageId} fieldId=${fieldId} elapsed_ms=${elapsed} error=${String(e)}`,
          );
        }
      } else {
        logger.info(
          `updateFieldValue mutation failed id=${messageId} fieldId=${fieldId} error=${String(
            result.error,
          )}`,
        );
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

/**
 * Helper to get SVG Data URI for hex color
 */
function getIconForColor(hex: string): vscode.Uri {
  const color = hex || "#848d97";
  const svg = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="5" fill="${color}"/></svg>`;
  const encoded = Buffer.from(svg).toString("base64");
  return vscode.Uri.parse(`data:image/svg+xml;base64,${encoded}`);
}

/**
 * Normalize color to hex or resolve name
 */
function normalizeColor(color: any): string | null {
  if (!color) return null;
  let n = String(color).trim();
  if (
    /^#?[0-9a-f]{3}$/i.test(n) ||
    /^#?[0-9a-f]{6}$/i.test(n) ||
    /^#?[0-9a-f]{8}$/i.test(n)
  ) {
    let b = n[0] === "#" ? n.slice(1) : n;
    return "#" + (b.length === 8 ? b.substring(0, 6) : b);
  }
  let s = {
    GRAY: "#848d97",
    RED: "#f85149",
    ORANGE: "#db6d28",
    YELLOW: "#d29922",
    GREEN: "#3fb950",
    BLUE: "#2f81f7",
    PURPLE: "#a371f7",
    PINK: "#db61a2",
    BLACK: "#000000",
    WHITE: "#ffffff",
  };
  let u = n.toUpperCase();
  return (s as any)[u] || null;
}
