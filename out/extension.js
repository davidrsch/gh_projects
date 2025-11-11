"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const graphql_1 = require("@octokit/graphql");
const p_map_1 = __importDefault(require("p-map"));
const GIT_DIR = '.git';
const SSH_COLON = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const HTTPS = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SSH_SCHEME = /^ssh:\/\/(?:git@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const GIT_SCHEME = /^git:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SCP_ALIAS = /^([^@:\/]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const ALLOWED_HOSTS = new Set(['github.com', 'gh']);
// Parse Git remote URLs
function parseRemote(url) {
    const matchers = [SSH_COLON, HTTPS, SSH_SCHEME, GIT_SCHEME, SCP_ALIAS];
    for (const rx of matchers) {
        const m = url.match(rx);
        if (m)
            return { host: m[1].toLowerCase(), owner: m[2], repo: m[3] };
    }
    return undefined;
}
function isGithubHostLike(host) {
    return ALLOWED_HOSTS.has(host) || !host.includes('.');
}
// Use VSCode GitHub authentication
async function getGithubAccessToken() {
    try {
        // request both repo access and project read access
        const session = await vscode.authentication.getSession('github', ['repo', 'read:project'], { createIfNone: true });
        return session?.accessToken;
    }
    catch (err) {
        console.error('GitHub auth error:', err);
        return undefined;
    }
}
// Recursively find git repos under a folder
function findGitRepos(root) {
    const results = [];
    function walk(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        if (entries.some(e => e.isDirectory() && e.name === GIT_DIR)) {
            results.push(dir);
            return; // do not recurse into subfolders of a git repo
        }
        for (const e of entries) {
            if (e.isDirectory())
                walk(path.join(dir, e.name));
        }
    }
    walk(root);
    return results.sort();
}
// Read remotes from .git/config
function readGitRemotes(repoPath) {
    const configPath = path.join(repoPath, GIT_DIR, 'config');
    if (!fs.existsSync(configPath))
        return [];
    const content = fs.readFileSync(configPath, 'utf8');
    const remotes = [];
    const regex = /\[remote "(.+?)"\]\s+url = (.+)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        remotes.push({ name: m[1], url: m[2] });
    }
    return remotes;
}
// Pick preferred remote (origin first, else first)
function pickPreferred(remotes) {
    if (!remotes.length)
        return undefined;
    const origin = remotes.find(r => r.name === 'origin');
    if (origin)
        return origin;
    return remotes[0];
}
// Fetch projects for a repo using GraphQL
async function fetchProjects(owner, repo, token, output) {
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
    const results = [];
    let after = null;
    while (true) {
        try {
            const data = await (0, graphql_1.graphql)(query, { owner, repo, after, headers: { authorization: `token ${token}` } });
            const conn = data?.repository?.projectsV2;
            if (!conn)
                break;
            for (const n of conn.nodes ?? []) {
                if (n?.id && n?.title && n?.url)
                    results.push({ ...n, owner, repo, repoPath: '' });
            }
            if (!conn.pageInfo?.hasNextPage || !conn.pageInfo.endCursor)
                break;
            after = conn.pageInfo.endCursor;
        }
        catch (err) {
            output.appendLine(`[graphql error] ${owner}/${repo} -> ${err instanceof Error ? err.message : String(err)}`);
            break;
        }
    }
    return results;
}
function activate(context) {
    const output = vscode.window.createOutputChannel('Github Projects');
    class ProjectsProvider {
        constructor() {
            this._onDidChangeTreeData = new vscode.EventEmitter();
            this.onDidChangeTreeData = this._onDidChangeTreeData.event;
            this.cache = new Map();
        }
        refresh() { this._onDidChangeTreeData.fire(); }
        getTreeItem(e) {
            const item = new vscode.TreeItem(e.title, vscode.TreeItemCollapsibleState.None);
            item.tooltip = `${e.url}\n[${e.owner}/${e.repo}] ${e.repoPath}`;
            item.description = e.url;
            item.command = { command: 'vscode.open', title: 'Open Project', arguments: [vscode.Uri.parse(e.url)] };
            return item;
        }
        async getChildren() {
            output.show(true);
            output.clear();
            output.appendLine('--- GitHub Projects scan start ---');
            const token = await getGithubAccessToken();
            if (!token) {
                output.appendLine('[auth] No GitHub token found.');
                return [];
            }
            const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [process.cwd()];
            let allRepos = [];
            for (const root of workspaceRoots) {
                allRepos = allRepos.concat(findGitRepos(root));
            }
            output.appendLine(`[scan] found ${allRepos.length} git repositories under workspace`);
            const unique = new Map();
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'Fetching GitHub projects...' }, async () => {
                const results = await (0, p_map_1.default)(allRepos, async (repoPath) => {
                    output.appendLine(`\n[repo] ${repoPath}`);
                    const remotes = readGitRemotes(repoPath);
                    const preferred = pickPreferred(remotes);
                    if (!preferred)
                        return [];
                    const parsed = parseRemote(preferred.url);
                    if (!parsed || !isGithubHostLike(parsed.host))
                        return [];
                    output.appendLine(`  [graphql] fetching projects for ${parsed.owner}/${parsed.repo}`);
                    const projects = await fetchProjects(parsed.owner, parsed.repo, token, output);
                    return projects.map(p => ({ ...p, repoPath }));
                }, { concurrency: 3 }); // limit parallel requests
                for (const list of results) {
                    for (const p of list) {
                        if (!unique.has(p.id))
                            unique.set(p.id, p);
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
function deactivate() { }
//# sourceMappingURL=extension.js.map