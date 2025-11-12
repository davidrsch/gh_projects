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
exports.ProjectsProvider = void 0;
const vscode = __importStar(require("vscode"));
const p_map_1 = __importDefault(require("p-map"));
const gitUtils_1 = require("../gitUtils");
const github_1 = require("../github");
class ProjectsProvider {
    constructor(output) {
        this.output = output;
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
        const output = this.output;
        output.show(true);
        output.clear();
        output.appendLine('--- GitHub Projects scan start ---');
        const token = await (0, github_1.getGithubAccessToken)();
        if (!token) {
            output.appendLine('[auth] No GitHub token found.');
            return [];
        }
        const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [process.cwd()];
        let allRepos = [];
        for (const root of workspaceRoots) {
            allRepos = allRepos.concat((0, gitUtils_1.findGitRepos)(root));
        }
        output.appendLine(`[scan] found ${allRepos.length} git repositories under workspace`);
        const unique = new Map();
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'Fetching GitHub projects...' }, async () => {
            const results = await (0, p_map_1.default)(allRepos, async (repoPath) => {
                output.appendLine(`\n[repo] ${repoPath}`);
                const remotes = (0, gitUtils_1.readGitRemotes)(repoPath);
                const preferred = (0, gitUtils_1.pickPreferred)(remotes);
                if (!preferred)
                    return [];
                const parsed = (0, github_1.parseRemote)(preferred.url);
                if (!parsed || !(0, github_1.isGithubHostLike)(parsed.host))
                    return [];
                output.appendLine(`  [graphql] fetching projects for ${parsed.owner}/${parsed.repo}`);
                const projects = await (0, github_1.fetchProjects)(parsed.owner, parsed.repo, token, output);
                return projects.map(p => ({ ...p, repoPath }));
            }, { concurrency: 3 });
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
exports.ProjectsProvider = ProjectsProvider;
//# sourceMappingURL=projectsProvider.js.map