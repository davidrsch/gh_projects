import * as fs from "fs/promises";
import * as path from "path";

export type Repo = { name: string; path: string; gitType: "folder" | "file" };

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {
    return false;
  }
}

export async function gitTypeOf(
  dir: string,
): Promise<"folder" | "file" | null> {
  const gitPath = path.join(dir, ".git");
  if (!(await exists(gitPath))) return null;
  try {
    const s = await fs.lstat(gitPath);
    return s.isDirectory() ? "folder" : "file";
  } catch (e) {
    return null;
  }
}

export async function findGitRepos(
  root: string,
  maxDepth = 6,
): Promise<Repo[]> {
  const out: Repo[] = [];

  async function walk(cur: string, depth: number) {
    if (depth < 0) return;

    const gt = await gitTypeOf(cur);
    if (gt) {
      out.push({ name: path.basename(cur), path: cur, gitType: gt });
      return; // don't descend into repo
    }

    let entries: string[];
    try {
      entries = await fs.readdir(cur);
    } catch (e) {
      return;
    }

    for (const e of entries) {
      if (e === "node_modules" || e === ".git") continue;
      const full = path.join(cur, e);
      try {
        const st = await fs.lstat(full);
        if (st.isDirectory()) {
          await walk(full, depth - 1);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  await walk(root, maxDepth);
  return out;
}

export default findGitRepos;
