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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRemote = parseRemote;
exports.isGithubHostLike = isGithubHostLike;
exports.getGithubAccessToken = getGithubAccessToken;
exports.fetchProjects = fetchProjects;
const vscode = __importStar(require("vscode"));
const graphql_1 = require("@octokit/graphql");
const SSH_COLON = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const HTTPS = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SSH_SCHEME = /^ssh:\/\/(?:git@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const GIT_SCHEME = /^git:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SCP_ALIAS = /^([^@:\/]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const ALLOWED_HOSTS = new Set(['github.com', 'gh']);
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
async function getGithubAccessToken() {
    try {
        const session = await vscode.authentication.getSession('github', ['repo', 'read:project'], { createIfNone: true });
        return session?.accessToken;
    }
    catch (err) {
        console.error('GitHub auth error:', err);
        return undefined;
    }
}
async function fetchProjects(owner, repo, token, output) {
    const query = `
    query($owner:String!,$repo:String!,$after:String){
      repository(owner:$owner,name:$repo){
        projectsV2(first:100,after:$after){
          nodes {
            id
            title
            url
            number
            public
            owner { __typename ... on User { login } ... on Organization { login } }
            repositories { totalCount }
            views(first: 20) { nodes { id name number } }
          }
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
                if (n?.id && n?.title && n?.url) {
                    const node = {
                        id: n.id,
                        title: n.title,
                        url: n.url,
                        owner,
                        repo,
                        repoPath: '',
                        number: n.number,
                        public: n.public,
                        ownerLogin: n.owner?.login,
                        repoCount: n.repositories?.totalCount,
                        views: n.views?.nodes?.map((v) => ({ id: v.id, name: v.name, number: v.number })) ?? [],
                    };
                    results.push(node);
                }
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
//# sourceMappingURL=github.js.map