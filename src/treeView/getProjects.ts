import { execFile } from "child_process";
import promisePool from "../lib/promisePool";

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

function parseOwnerRepoFromUrl(
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
  const args = [
    "api",
    "graphql",
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
    "-f",
    `query=${gql}`,
  ];
  try {
    const { stdout } = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        execFile(
          "gh",
          args,
          { maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) return reject({ err, stdout, stderr });
            resolve({ stdout, stderr });
          },
        );
      },
    );
    const parsed = JSON.parse(stdout);
    const nodes =
      parsed &&
      parsed.data &&
      parsed.data.repository &&
      parsed.data.repository.projectsV2 &&
      parsed.data.repository.projectsV2.nodes;
    return { owner, name, projects: nodes || [] };
  } catch (e) {
    const ee: any = e;
    const stderr =
      (ee && (ee.stderr || (ee.err && ee.err.message))) || String(ee);
    return { owner, name, error: stderr };
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
