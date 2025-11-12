import * as fs from 'fs';
import * as path from 'path';

const GIT_DIR = '.git';

// Recursively find git repos under a folder
export function findGitRepos(root: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some(e => e.isDirectory() && e.name === GIT_DIR)) {
      results.push(dir);
      return; // do not recurse into subfolders of a git repo
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
    }
  }
  walk(root);
  return results.sort();
}

// Read remotes from .git/config
export function readGitRemotes(repoPath: string): { name: string; url: string }[] {
  const configPath = path.join(repoPath, GIT_DIR, 'config');
  if (!fs.existsSync(configPath)) return [];
  const content = fs.readFileSync(configPath, 'utf8');
  const remotes: { name: string; url: string }[] = [];
  const regex = /\[remote "(.+?)"\]\s+url = (.+)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    remotes.push({ name: m[1], url: m[2] });
  }
  return remotes;
}

// Pick preferred remote (origin first, else first)
export function pickPreferred(remotes: { name: string; url: string }[]): { name: string; url: string } | undefined {
  if (!remotes.length) return undefined;
  const origin = remotes.find(r => r.name === 'origin');
  return origin ?? remotes[0];
}
