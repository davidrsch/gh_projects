import * as vscode from "vscode";
import { execFile } from "child_process";
import promisePool from "../lib/promisePool";
import logger from "../lib/logger";
import { ghQueryWithErrors } from "../lib/ghApiHelper";
import * as fs from "fs";
import * as path from "path";
// Prefer workspace root for debug files when available (when running inside VS Code
// the process cwd may point to the VS Code install directory). Fall back to
// process.cwd() if no workspace is open.
const debugBaseDir = (() => {
  try {
    const wf =
      vscode.workspace &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0];
    return wf ? wf.uri.fsPath : process.cwd();
  } catch {
    return process.cwd();
  }
})();

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
  url: string
): { owner: string; name: string } | null {
  if (!url) return null;
  const s = url.trim();
  const m = s.match(
    /(?:[:\/])([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/
  );
  if (m) {
    return { owner: m[1], name: m[2].replace(/\.git$/, "") };
  }
  try {
    logger.debug(`parseOwnerRepoFromUrl: failed to parse url='${s}'`);
  } catch {}
  return null;
}

function runCmd(
  cmd: string,
  cwd?: string
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
      }
    );
  });
}

async function queryProjectsForOwnerRepo(owner: string, name: string) {
  const gql = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ projectsV2(first:100){ nodes{ id title shortDescription url } } } }`;

  try {
    const parsed = await ghQueryWithErrors(gql, { owner, name });
    // Always write the parsed response to a debug file so we can inspect it locally
    try {
      const debugDir = path.join(debugBaseDir, ".gh-debug");
      fs.mkdirSync(debugDir, { recursive: true });
      const fileName = `${owner}__${name}__${Date.now()}.json`;
      const filePath = path.join(debugDir, fileName);
      try {
        fs.writeFileSync(filePath, JSON.stringify(parsed || {}, null, 2), {
          encoding: "utf8",
        });
        logger.info(`queryProjectsForOwnerRepo: wrote debug file ${filePath}`);
      } catch (wfErr) {
        logger.debug(
          `queryProjectsForOwnerRepo: failed to write debug file: ${String(
            wfErr
          )}`
        );
      }
    } catch (dirErr) {
      logger.debug(
        `queryProjectsForOwnerRepo: failed to prepare debug dir: ${String(
          dirErr
        )}`
      );
    }
    // If the parsed response does not contain expected fields, log it at info level
    try {
      const repoNode = (parsed as any)?.data?.repository;
      const projectsNode =
        repoNode && repoNode.projectsV2 ? repoNode.projectsV2.nodes : undefined;
      if (
        !repoNode ||
        !Array.isArray(projectsNode) ||
        projectsNode.length === 0
      ) {
        // Log truncated full response to help diagnose empty results
        const raw = JSON.stringify(parsed || {});
        const t =
          raw.length > 5000 ? raw.slice(0, 5000) + "...[truncated]" : raw;
        logger.info(
          `queryProjectsForOwnerRepo: unexpected or empty projects result for ${owner}/${name}: ${t}`
        );
        try {
          // Also print to console so it appears in the Extension Host output
          // Use console.log (not console.debug) to ensure visibility
          const short =
            t.length > 2000 ? t.slice(0, 2000) + "...[truncated]" : t;
          // Prefix matches other ghProjects messages for easy filtering
          // Keep message compact to avoid flooding the log
          // eslint-disable-next-line no-console
          console.log(
            `ghProjects: queryProjectsForOwnerRepo parsed for ${owner}/${name}: ${short}`
          );
        } catch (_) {}
        // Also write a debug file so the user can inspect the full parsed response
        try {
          const debugDir = path.join(debugBaseDir, ".gh-debug");
          fs.mkdirSync(debugDir, { recursive: true });
          const fileName = `${owner}__${name}__${Date.now()}.json`;
          const filePath = path.join(debugDir, fileName);
          try {
            fs.writeFileSync(filePath, JSON.stringify(parsed || {}, null, 2), {
              encoding: "utf8",
            });
            logger.info(
              `queryProjectsForOwnerRepo: wrote debug file ${filePath}`
            );
            try {
              // Also echo file path to console for immediate visibility
              // eslint-disable-next-line no-console
              console.log(`ghProjects: wrote debug file ${filePath}`);
            } catch (_) {}
          } catch (wfErr) {
            logger.debug(
              `queryProjectsForOwnerRepo: failed to write debug file: ${String(
                wfErr
              )}`
            );
          }
        } catch (dirErr) {
          logger.debug(
            `queryProjectsForOwnerRepo: failed to prepare debug dir: ${String(
              dirErr
            )}`
          );
        }
      }
    } catch (logErr) {
      logger.debug(
        `queryProjectsForOwnerRepo: failed to log parsed response for ${owner}/${name}: ${String(
          logErr
        )}`
      );
    }
    try {
      // Log a truncated raw response for debugging repository project queries
      const raw = JSON.stringify(parsed);
      const t = raw.length > 2000 ? raw.slice(0, 2000) + "...[truncated]" : raw;
      logger.debug(`queryProjectsForOwnerRepo raw: ${t}`);
      try {
        console.debug &&
          console.debug(
            `ghProjects: queryProjectsForOwnerRepo raw for ${owner}/${name}: ${t}`
          );
      } catch {}
    } catch (e) {
      // ignore logging errors
    }
    const nodes =
      parsed &&
      (parsed as any).data &&
      (parsed as any).data.repository &&
      (parsed as any).data.repository.projectsV2 &&
      (parsed as any).data.repository.projectsV2.nodes;
    return { owner, name, projects: nodes || [] };
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    logger.error(
      `queryProjectsForOwnerRepo error for ${owner}/${name}: ${msg}`
    );
    try {
      // write an error debug file so we can inspect thrown errors and responses
      const debugDir = path.join(debugBaseDir, ".gh-debug");
      fs.mkdirSync(debugDir, { recursive: true });
      const fileName = `${owner}__${name}__error__${Date.now()}.json`;
      const filePath = path.join(debugDir, fileName);
      const safeErr = (() => {
        try {
          return JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
        } catch (_) {
          try {
            return JSON.stringify({ message: String(err) }, null, 2);
          } catch (__) {
            return String(err);
          }
        }
      })();
      try {
        fs.writeFileSync(
          filePath,
          JSON.stringify({ owner, name, error: msg, raw: safeErr }, null, 2),
          { encoding: "utf8" }
        );
        logger.info(
          `queryProjectsForOwnerRepo: wrote error debug file ${filePath}`
        );
        try {
          // eslint-disable-next-line no-console
          console.log(`ghProjects: wrote error debug file ${filePath}`);
        } catch (_) {}
      } catch (wfErr) {
        logger.debug(
          `queryProjectsForOwnerRepo: failed to write error debug file: ${String(
            wfErr
          )}`
        );
      }
    } catch (dirErr) {
      logger.debug(
        `queryProjectsForOwnerRepo: failed to prepare error debug dir: ${String(
          dirErr
        )}`
      );
    }
    return { owner, name, error: msg };
  }
}

export async function getProjectsForReposArray(
  arr: RepoItem[]
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
          try {
            logger.debug(
              `getProjectsForReposArray: added map key=${or.owner}/${or.name}`
            );
          } catch {}
          try {
            console.debug &&
              console.debug(
                `ghProjects: getProjectsForReposArray: added map key=${or.owner}/${or.name}`
              );
          } catch {}
        } else {
          try {
            logger.debug(
              `getProjectsForReposArray: remote url did not parse: ${String(
                url
              )}`
            );
          } catch {}
        }
      }
    }
    if ((!remotes || remotes.length === 0) && item && item.path) {
      runCmdTasks.push(async () => {
        try {
          const res = await runCmd("git remote get-url origin", item.path);
          const or = parseOwnerRepoFromUrl(res.stdout.trim());
          if (or) map.set(`${or.owner}/${or.name}`, or);
          try {
            logger.debug(
              `getProjectsForReposArray: runCmd parsed ${item.path} -> ${or?.owner}/${or?.name}`
            );
          } catch {}
          try {
            console.debug &&
              console.debug(
                `ghProjects: getProjectsForReposArray: runCmd parsed ${item.path} -> ${or?.owner}/${or?.name}`
              );
          } catch {}
        } catch {
          logger.debug(
            `getProjectsForReposArray: git remote get-url failed for path ${item.path}`
          );
        }
      });
    }
  }

  const maxConcurrency = 4;
  try {
    logger.debug(
      `getProjectsForReposArray: runCmdTasks count=${runCmdTasks.length}`
    );
  } catch {}
  try {
    console.debug &&
      console.debug(
        `ghProjects: getProjectsForReposArray: runCmdTasks count=${runCmdTasks.length}`
      );
  } catch {}
  if (runCmdTasks.length > 0)
    await promisePool<void>(runCmdTasks, maxConcurrency);

  const owners = Array.from(map.values());
  try {
    logger.debug(
      `getProjectsForReposArray: owners to query count=${owners.length}`
    );
  } catch {}
  try {
    console.debug &&
      console.debug(
        `ghProjects: getProjectsForReposArray: owners to query count=${owners.length}`
      );
  } catch {}
  const tasks: Array<() => Promise<ParsedRepoEntry>> = owners.map((o) => {
    return async () => {
      try {
        const r = await queryProjectsForOwnerRepo(o.owner, o.name);
        try {
          logger.debug(
            `getProjectsForReposArray: queryProjectsForOwnerRepo returned for ${
              o.owner
            }/${o.name} projects=${
              (r && (r as any).projects && (r as any).projects.length) || 0
            }`
          );
        } catch {}
        try {
          console.debug &&
            console.debug(
              `ghProjects: getProjectsForReposArray: queryProjectsForOwnerRepo returned for ${
                o.owner
              }/${o.name} projects=${
                (r && (r as any).projects && (r as any).projects.length) || 0
              }`
            );
        } catch {}
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
