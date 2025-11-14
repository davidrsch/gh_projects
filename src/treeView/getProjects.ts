import { execFile } from 'child_process';

type Repo = { name?: string; path?: string; gitType?: string };

function parseOwnerRepoFromUrl(url: string): { owner: string; name: string } | null {
  if (!url) return null;
  const s = url.trim();
  const m = s.match(/(?:[:\/])([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/);
  if (m) {
    return { owner: m[1], name: m[2].replace(/\.git$/, '') };
  }
  return null;
}

function runCmd(cmd: string, cwd?: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-Command', cmd], { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

async function queryProjectsForOwnerRepo(owner: string, name: string) {
  const gql = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ projectsV2(first:100){ nodes{ id title shortDescription url } } } }`;
  const args = ['api', 'graphql', '-f', `owner=${owner}`, '-f', `name=${name}`, '-f', `query=${gql}`];
  try {
    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile('gh', args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject({ err, stdout, stderr });
        resolve({ stdout, stderr });
      });
    });
    const parsed = JSON.parse(stdout);
    const nodes = parsed && parsed.data && parsed.data.repository && parsed.data.repository.projectsV2 && parsed.data.repository.projectsV2.nodes;
    return { owner, name, projects: nodes || [] };
  } catch (e) {
    const ee: any = e;
    const stderr = (ee && (ee.stderr || (ee.err && ee.err.message))) || String(ee);
    return { owner, name, error: stderr };
  }
}

export async function getProjectsForReposArray(arr: any[]) {
  const map = new Map<string, { owner: string; name: string }>();
  for (const item of arr) {
    const remotes = item && item.remotes ? item.remotes : (item.remotes || item.remote || []);
    if (Array.isArray(remotes) && remotes.length > 0) {
      for (const r of remotes) {
        const url = r && (r.url || r);
        const or = parseOwnerRepoFromUrl(url);
        if (or) map.set(`${or.owner}/${or.name}`, or);
      }
    }
    if ((!remotes || remotes.length === 0) && item && item.path) {
      try {
        const res = await runCmd('git remote get-url origin', item.path);
        const or = parseOwnerRepoFromUrl(res.stdout.trim());
        if (or) map.set(`${or.owner}/${or.name}`, or);
      } catch {
        // ignore
      }
    }
  }

  const out: any[] = [];
  for (const { owner, name } of map.values()) {
    // sequential to avoid rate/cli overload
    // eslint-disable-next-line no-await-in-loop
    const r = await queryProjectsForOwnerRepo(owner, name);
    out.push(r);
  }
  return out;
}

export default getProjectsForReposArray;
