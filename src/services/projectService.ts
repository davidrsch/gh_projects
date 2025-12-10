import * as vscode from "vscode";
import findGitRepos from "../treeView/findRepos";
import getRemotesForPath from "../treeView/getRemotes";
import { parseOwnerRepoFromUrl } from "../lib/projectUtils";
import { GitHubRepository } from "./GitHubRepository";
import { uniqueProjectsFromResults } from "../lib/projectUtils";
import logger from "../lib/logger";
import promisePool from "../lib/promisePool";
import {
  ProjectEntry,
  ProjectView,
  RepoItem,
  ParsedRepoEntry,
} from "../lib/types";
import { execFile } from "child_process";

export class ProjectService {
  private githubRepository: GitHubRepository;

  constructor() {
    this.githubRepository = GitHubRepository.getInstance();
  }

  public async loadProjects(workspaceRoot: string): Promise<ProjectEntry[]> {
    logger.debug(`loadProjects: starting for workspaceRoot=${workspaceRoot}`);

    const maxDepth = vscode.workspace
      .getConfiguration("ghProjects")
      .get<number>("maxDepth", 4);
    let repos: any[] = [];
    try {
      repos = await findGitRepos(workspaceRoot, maxDepth);
      logger.debug(
        `loadProjects: findGitRepos returned ${repos?.length ?? 0} repos`,
      );
    } catch (e) {
      logger.error("loadProjects: findGitRepos threw: " + String(e));
      throw e;
    }

    if (!repos || repos.length === 0) {
      logger.info("No git repos found", { workspaceRoot });
      return [];
    }

    const items: RepoItem[] = [];
    const maxConcurrency = vscode.workspace
      .getConfiguration("ghProjects")
      .get<number>("maxConcurrency", 4);

    const remoteTasks: Array<() => Promise<void>> = repos.map((r) => {
      return async () => {
        const remotes = await getRemotesForPath(r.path);
        items.push({ path: r.path, remotes });
      };
    });

    await promisePool<void>(remoteTasks, maxConcurrency);

    let projectQueries: ParsedRepoEntry[] = [];
    try {
      projectQueries = await this.getProjectsForReposArray(items);
      logger.debug(
        `[ghProjects] Project queries result: ${projectQueries?.length ?? 0}`,
      );
    } catch (e) {
      logger.error("getProjectsForReposArray threw: " + String(e));
      projectQueries = [];
    }

    if (!projectQueries || projectQueries.length === 0) {
      logger.info("No project query results for discovered repos", {
        reposCount: items.length,
      });
      return [];
    }

    const unique = uniqueProjectsFromResults(projectQueries);
    logger.info(`[ghProjects] Unique projects: ${unique.length}`);

    const mapped: ProjectEntry[] = unique.map((p: any) => ({
      id: p.id || p.url || p.title || "<unknown>",
      title: p.title,
      shortDescription: p.shortDescription || null,
      description: p.description ?? null,
      url: p.url,
      repos: p.repos,
      views: undefined,
    }));

    const tasks: Array<() => Promise<ProjectView[]>> = mapped.map((proj) => {
      return async () => {
        if (!proj.id) return [];
        try {
          return await this.githubRepository.fetchProjectViews(proj.id);
        } catch (e) {
          return [];
        }
      };
    });

    const res = await promisePool<ProjectView[]>(tasks, maxConcurrency);
    for (let i = 0; i < mapped.length; i++) {
      mapped[i].views = Array.isArray(res[i]) ? res[i] : [];
    }
    logger.info("[ghProjects] Projects with views: " + mapped.length);

    return mapped;
  }

  private async getProjectsForReposArray(
    arr: RepoItem[],
  ): Promise<ParsedRepoEntry[]> {
    const map = new Map<string, { owner: string; name: string }>();
    const runCmdTasks: Array<() => Promise<void>> = [];

    for (const item of arr || []) {
      const remotesRaw = (item && (item.remotes ?? item.remote)) ?? [];
      const remotes = Array.isArray(remotesRaw) ? remotesRaw : [remotesRaw];
      if (Array.isArray(remotes) && remotes.length > 0) {
        for (const r of remotes) {
          const url =
            (r && (typeof r === "string" ? r : (r as any).url)) || (r as any);
          const or = parseOwnerRepoFromUrl(String(url || ""));
          if (or) {
            map.set(`${or.owner}/${or.name}`, or);
          }
        }
      }
      if ((!remotes || remotes.length === 0) && item && item.path) {
        runCmdTasks.push(async () => {
          try {
            const res = await this.runCmd(
              "git remote get-url origin",
              item.path,
            );
            const or = parseOwnerRepoFromUrl(res.stdout.trim());
            if (or) map.set(`${or.owner}/${or.name}`, or);
          } catch (e) {
            // ignore
          }
        });
      }
    }

    if (runCmdTasks.length > 0) {
      await promisePool<void>(runCmdTasks, 4);
    }

    const owners = Array.from(map.values());
    const tasks: Array<() => Promise<ParsedRepoEntry>> = owners.map((o) => {
      return async () => {
        try {
          return await this.githubRepository.getProjects(o.owner, o.name);
        } catch (e: any) {
          return { owner: o.owner, name: o.name, error: String(e || "") };
        }
      };
    });

    return await promisePool<ParsedRepoEntry>(tasks, 4);
  }

  private runCmd(
    cmd: string,
    cwd?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const parts = String(cmd || "")
      .trim()
      .split(/\s+/);
    if (parts[0] === "git") parts.shift();
    return new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        execFile(
          "git",
          parts,
          { cwd, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) return reject({ err, stdout, stderr });
            resolve({ stdout, stderr });
          },
        );
      },
    );
  }
}
