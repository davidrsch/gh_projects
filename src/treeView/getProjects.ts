import * as vscode from "vscode";
import { execFile } from "child_process";
import promisePool from "../lib/promisePool";
import logger from "../lib/logger";
import { ghQueryWithErrors } from "../lib/ghApiHelper";
import ghRunner from "../lib/ghRunner";

type Repo = { name?: string; path?: string; gitType?: string };

export type RepoRemoteRef = { url?: string };
export type RepoItem = {
  path?: string;
  remotes?: RepoRemoteRef[] | RepoRemoteRef;
  remote?: RepoRemoteRef | RepoRemoteRef[];
};

export interface ParsedRepoEntry {
  owner?: string;
  name?: string;
  projects?: Array<{
    id?: string;
    title?: string;
    shortDescription?: string;
    url?: string;
  }>;
  error?: string;
}

export function parseOwnerRepoFromUrl(
  url: string,
): { owner: string; name: string } | null {
  if (!url) return null;
  const s = url.trim();
  const m = s.match(/(?:[:\/])([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/);
  if (m) {
    return { owner: m[1], name: m[2].replace(/\.git$/, "") };
  }
  return null;
}

function runCmd(
  cmd: string,
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  // For cross-platform compatibility, invoke git directly instead of a shell.
  // `cmd` is expected to be a simple git subcommand string like "git remote get-url origin".
  const parts = String(cmd || "")
    .trim()
    .split(/\s+/);
  // If the caller passed the full string starting with 'git', strip it.
  if (parts[0] === "git") parts.shift();
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      "git",
      parts,
      { cwd, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject({ err, stdout, stderr });
        resolve({ stdout, stderr });
      },
    );
  });
}

async function queryProjectsForOwnerRepo(owner: string, name: string) {
  const gql = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ projectsV2(first:100){ nodes{ id title shortDescription url } } } }`;

  const preferHttp = vscode.workspace
    .getConfiguration("ghProjects")
    .get<boolean>("preferHttp", false);

  // If preferHttp is enabled, enforce HTTP-only and bubble auth errors.
  if (preferHttp) {
    try {
      const parsed = await ghQueryWithErrors(gql, { owner, name });
      const nodes =
        parsed &&
        (parsed as any).data &&
        (parsed as any).data.repository &&
        (parsed as any).data.repository.projectsV2 &&
        (parsed as any).data.repository.projectsV2.nodes;
      return { owner, name, projects: nodes || [] };
    } catch (err: any) {
      // Bubble auth/perms as well as other normalized errors as a well-formed result
      const msg = String(err?.message || err || "");
      return { owner, name, error: msg };
    }
  }

  // Default behavior: try HTTP first, then fall back to CLI on auth/availability errors.
  try {
    const parsed = await ghQueryWithErrors(gql, { owner, name });
    const nodes =
      parsed &&
      (parsed as any).data &&
      (parsed as any).data.repository &&
      (parsed as any).data.repository.projectsV2 &&
      (parsed as any).data.repository.projectsV2.nodes;
    return { owner, name, projects: nodes || [] };
  } catch (err: any) {
    const code = String(err?.code || "").toUpperCase();
    const msg = String(err?.message || err || "");
    const isAuthProblem =
      code === "ENOTAUTH" || code === "EPERM" || /not authenticated/i.test(msg);
    if (isAuthProblem) {
      logger.debug(
        `ghQueryWithErrors failed for ${owner}/${name}, falling back to gh CLI: ${msg}`,
      );
      // Fallback to gh CLI via ghRunner
      try {
        const res = await ghRunner.ghGraphQLQuery(gql, { owner, name });
        const nodes =
          res &&
          (res as any).data &&
          (res as any).data.repository &&
          (res as any).data.repository.projectsV2 &&
          (res as any).data.repository.projectsV2.nodes;
        return { owner, name, projects: nodes || [] };
      } catch (ghErr: any) {
        const stderr = String(ghErr?.message || ghErr || "");
        logger.error(`gh CLI fallback failed for ${owner}/${name}: ${stderr}`);
        return { owner, name, error: stderr };
      }
    }

    logger.error(
      `queryProjectsForOwnerRepo error for ${owner}/${name}: ${msg}`,
    );
    return { owner, name, error: msg };
  }
}

export async function getProjectsForReposArray(
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
        if (or) map.set(`${or.owner}/${or.name}`, or);
      }
    }
    if ((!remotes || remotes.length === 0) && item && item.path) {
      runCmdTasks.push(async () => {
        try {
          const res = await runCmd("git remote get-url origin", item.path);
          const or = parseOwnerRepoFromUrl(res.stdout.trim());
          if (or) map.set(`${or.owner}/${or.name}`, or);
        } catch {
          // ignore per-repo failures
        }
      });
    }
  }

  const maxConcurrency = 4;
  if (runCmdTasks.length > 0)
    await promisePool<void>(runCmdTasks, maxConcurrency);

  const owners = Array.from(map.values());
  const tasks: Array<() => Promise<ParsedRepoEntry>> = owners.map((o) => {
    return async () => {
      try {
        const r = await queryProjectsForOwnerRepo(o.owner, o.name);
        return r as ParsedRepoEntry;
      } catch (e: any) {
        return { owner: o.owner, name: o.name, error: String(e || "") };
      }
    };
  });

  const results = await promisePool<ParsedRepoEntry>(tasks, 4);
  return results;
}

export default getProjectsForReposArray;
