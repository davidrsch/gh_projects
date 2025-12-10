import findGitRepos from "../treeView/findRepos";
import getRemotesForPath from "../treeView/getRemotes";
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
import { ConfigReader, getConfigReader } from "../lib/config";

export class ProjectService {
  private githubRepository: GitHubRepository;
  private configReader: ConfigReader;

  constructor(configReader?: ConfigReader) {
    this.githubRepository = GitHubRepository.getInstance();
    this.configReader = configReader || getConfigReader();
  }

  public async loadProjects(workspaceRoot: string): Promise<ProjectEntry[]> {
    logger.debug(`loadProjects: starting for workspaceRoot=${workspaceRoot}`);

    const maxDepth = this.configReader.get("maxDepth", 4);
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
    const maxConcurrency = this.configReader.get("maxConcurrency", 4);

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
    const { extractGitHubRepos } = await import("./repositoryDiscovery");
    const repos = await extractGitHubRepos(
      arr,
      this.configReader.get("maxConcurrency", 4),
    );

    const tasks: Array<() => Promise<ParsedRepoEntry>> = repos.map((repo) => {
      return async () => {
        try {
          return await this.githubRepository.getProjects(repo.owner, repo.name);
        } catch (e: any) {
          return { owner: repo.owner, name: repo.name, error: String(e || "") };
        }
      };
    });

    return await promisePool<ParsedRepoEntry>(
      tasks,
      this.configReader.get("maxConcurrency", 4),
    );
  }
}
