import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { graphql } from '@octokit/graphql';
import pMap from 'p-map';

interface ProjectNode {
  id: string;
  title: string;
  url: string;
  repoPath: string;
  owner: string;
  repo: string;
}

const GIT_DIR = '.git';
const SSH_COLON = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const HTTPS = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SSH_SCHEME = /^ssh:\/\/(?:git@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const GIT_SCHEME = /^git:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SCP_ALIAS = /^([^@:\/]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const ALLOWED_HOSTS = new Set(['github.com', 'gh']);

// Parse Git remote URLs
function parseRemote(url: string): { host: string; owner: string; repo: string } | undefined {
  const matchers = [SSH_COLON, HTTPS, SSH_SCHEME, GIT_SCHEME, SCP_ALIAS];
  for (const rx of matchers) {
    const m = url.match(rx);
    if (m) return { host: m[1].toLowerCase(), owner: m[2], repo: m[3] };
  }
  return undefined;
}

function isGithubHostLike(host: string) {
  return ALLOWED_HOSTS.has(host) || !host.includes('.');
}

// Use VSCode GitHub authentication
async function getGithubAccessToken(): Promise<string | undefined> {
  try {
    // request both repo access and project read access
    const session = await vscode.authentication.getSession(
      'github',
      ['repo', 'read:project'],
      { createIfNone: true }
    );
    return session?.accessToken;
  } catch (err) {
    console.error('GitHub auth error:', err);
    return undefined;
  }
}

// Recursively find git repos under a folder
function findGitRepos(root: string): string[] {
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
function readGitRemotes(repoPath: string): { name: string; url: string }[] {
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
function pickPreferred(remotes: { name: string; url: string }[]): { name: string; url: string } | undefined {
  if (!remotes.length) return undefined;
  const origin = remotes.find(r => r.name === 'origin');
  if (origin) return origin;
  return remotes[0];
}

// Fetch projects for a repo using GraphQL
async function fetchProjects(owner: string, repo: string, token: string, output: vscode.OutputChannel): Promise<ProjectNode[]> {
  const query = `
    query($owner:String!,$repo:String!,$after:String){
      repository(owner:$owner,name:$repo){
        projectsV2(first:100,after:$after){
          nodes { id title url }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  const results: ProjectNode[] = [];
  let after: string | null = null;

  while (true) {
    try {
      const data: any = await graphql(query, { owner, repo, after, headers: { authorization: `token ${token}` } });
      const conn = data?.repository?.projectsV2;
      if (!conn) break;

      for (const n of conn.nodes ?? []) {
        if (n?.id && n?.title && n?.url) results.push({ ...n, owner, repo, repoPath: '' });
      }

      if (!conn.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break;
      after = conn.pageInfo.endCursor;
    } catch (err) {
      output.appendLine(`[graphql error] ${owner}/${repo} -> ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  return results;
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Github Projects');

  class ProjectsProvider implements vscode.TreeDataProvider<ProjectNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ProjectNode | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private cache: Map<string, ProjectNode> = new Map();
    refresh() { this._onDidChangeTreeData.fire(); }

    getTreeItem(e: ProjectNode): vscode.TreeItem {
      const item = new vscode.TreeItem(e.title, vscode.TreeItemCollapsibleState.None);
      item.tooltip = `${e.url}\n[${e.owner}/${e.repo}] ${e.repoPath}`;
      item.description = e.url;
      item.command = { command: 'vscode.open', title: 'Open Project', arguments: [vscode.Uri.parse(e.url)] };
      return item;
    }

    async getChildren(): Promise<ProjectNode[]> {
      output.show(true);
      output.clear();
      output.appendLine('--- GitHub Projects scan start ---');

      const token = await getGithubAccessToken();
      if (!token) {
        output.appendLine('[auth] No GitHub token found.');
        return [];
      }

      const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [process.cwd()];
      let allRepos: string[] = [];
      for (const root of workspaceRoots) {
        allRepos = allRepos.concat(findGitRepos(root));
      }

      output.appendLine(`[scan] found ${allRepos.length} git repositories under workspace`);

      const unique = new Map<string, ProjectNode>();

      await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'Fetching GitHub projects...' }, async () => {
        const results = await pMap(allRepos, async (repoPath) => {
          output.appendLine(`\n[repo] ${repoPath}`);
          const remotes = readGitRemotes(repoPath);
          const preferred = pickPreferred(remotes);
          if (!preferred) return [];

          const parsed = parseRemote(preferred.url);
          if (!parsed || !isGithubHostLike(parsed.host)) return [];

          output.appendLine(`  [graphql] fetching projects for ${parsed.owner}/${parsed.repo}`);
          const projects = await fetchProjects(parsed.owner, parsed.repo, token, output);
          return projects.map(p => ({ ...p, repoPath }));
        }, { concurrency: 3 }); // limit parallel requests

        for (const list of results) {
          for (const p of list) {
            if (!unique.has(p.id)) unique.set(p.id, p);
          }
        }
      });

      this.cache = unique;
      output.appendLine(`\n[summary] unique projects: ${unique.size}`);
      return Array.from(unique.values()).sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  const provider = new ProjectsProvider();
  context.subscriptions.push(vscode.window.registerTreeDataProvider('projects', provider));
  context.subscriptions.push(vscode.commands.registerCommand('ghProjects.refresh', () => provider.refresh()));
}

export function deactivate() {}
