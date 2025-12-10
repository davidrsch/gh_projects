/**
 * Repository discovery module - responsible for finding and parsing GitHub repositories
 * from local git repositories and their remotes.
 */
import { parseOwnerRepoFromUrl } from "../lib/projectUtils";
import { RepoItem } from "../lib/types";
import promisePool from "../lib/promisePool";
import { execFile } from "child_process";

export interface GitHubRepo {
  owner: string;
  name: string;
}

/**
 * Extract GitHub owner/repo pairs from repository items.
 * Handles various remote formats and falls back to git commands if needed.
 */
export async function extractGitHubRepos(
  items: RepoItem[],
  maxConcurrency: number = 4,
): Promise<GitHubRepo[]> {
  const map = new Map<string, GitHubRepo>();
  const fallbackTasks: Array<() => Promise<void>> = [];

  // First pass: extract from existing remotes
  for (const item of items || []) {
    const remotesRaw = (item && (item.remotes ?? (item as any).remote)) ?? [];
    const remotes = Array.isArray(remotesRaw) ? remotesRaw : [remotesRaw];

    if (Array.isArray(remotes) && remotes.length > 0) {
      for (const r of remotes) {
        const url =
          (r && (typeof r === "string" ? r : (r as any).url)) || (r as any);
        const parsed = parseOwnerRepoFromUrl(String(url || ""));
        if (parsed) {
          map.set(`${parsed.owner}/${parsed.name}`, parsed);
        }
      }
    }

    // If no remotes found, queue a task to query git directly
    if ((!remotes || remotes.length === 0) && item?.path) {
      const repoPath = item.path;
      fallbackTasks.push(async () => {
        try {
          const result = await getRemoteUrl(repoPath, "origin");
          const parsed = parseOwnerRepoFromUrl(result);
          if (parsed) {
            map.set(`${parsed.owner}/${parsed.name}`, parsed);
          }
        } catch (e) {
          // Ignore - not all repos have origin remote
        }
      });
    }
  }

  // Execute fallback tasks if any
  if (fallbackTasks.length > 0) {
    await promisePool<void>(fallbackTasks, maxConcurrency);
  }

  return Array.from(map.values());
}

/**
 * Get the URL for a git remote using git command.
 */
async function getRemoteUrl(
  repoPath: string,
  remoteName: string = "origin",
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    execFile(
      "git",
      ["remote", "get-url", remoteName],
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message));
        }
        resolve(stdout.trim());
      },
    );
  });
}
