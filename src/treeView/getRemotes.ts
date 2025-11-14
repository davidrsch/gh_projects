import { exec } from 'child_process';
import * as path from 'path';

export type Remote = { name: string; url: string; push?: boolean };

export function getRemotesForPath(cwd: string): Promise<Remote[]> {
  return new Promise((resolve) => {
    exec('git remote -v', { cwd }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr && stderr.toString()) || (err && err.message) || String(err);
        return resolve([{ name: 'error', url: msg, push: false }]);
      }

      const lines = stdout.toString().trim().split(/\r?\n/).filter(Boolean);
      const remotes: Remote[] = [];
      for (const ln of lines) {
        const m = ln.match(/^([^\t\s]+)\s+([^\s]+)\s+\((fetch|push)\)$/);
        if (m) {
          const [, name, url, type] = m;
          const existing = remotes.find((x) => x.name === name && x.url === url);
          if (existing) {
            if (type === 'push') existing.push = true;
          } else {
            remotes.push({ name, url, push: type === 'push' });
          }
        }
      }
      resolve(remotes);
    });
  });
}

export default getRemotesForPath;
