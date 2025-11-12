import * as vscode from 'vscode';
import { graphql } from '@octokit/graphql';
import { ProjectNode } from './model';

const SSH_COLON = /^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/i;
const HTTPS = /^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SSH_SCHEME = /^ssh:\/\/(?:git@)?([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const GIT_SCHEME = /^git:\/\/([^/]+)\/([^/]+)\/(.+?)(?:\.git)?$/i;
const SCP_ALIAS = /^([^@:\/]+):([^/]+)\/(.+?)(?:\.git)?$/i;

const ALLOWED_HOSTS = new Set(['github.com', 'gh']);

export function parseRemote(url: string): { host: string; owner: string; repo: string } | undefined {
  const matchers = [SSH_COLON, HTTPS, SSH_SCHEME, GIT_SCHEME, SCP_ALIAS];
  for (const rx of matchers) {
    const m = url.match(rx);
    if (m) return { host: m[1].toLowerCase(), owner: m[2], repo: m[3] };
  }
  return undefined;
}

export function isGithubHostLike(host: string) {
  return ALLOWED_HOSTS.has(host) || !host.includes('.');
}

export async function getGithubAccessToken(): Promise<string | undefined> {
  try {
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

export async function fetchProjects(
  owner: string,
  repo: string,
  token: string,
  output: vscode.OutputChannel
): Promise<ProjectNode[]> {
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

  const results: ProjectNode[] = [];
  let after: string | null = null;

  while (true) {
    try {
      const data: any = await graphql(query, { owner, repo, after, headers: { authorization: `token ${token}` } });
      const conn = data?.repository?.projectsV2;
      if (!conn) break;

      for (const n of conn.nodes ?? []) {
        if (n?.id && n?.title && n?.url) {
          const node: ProjectNode = {
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
            views: n.views?.nodes?.map((v: any) => ({ id: v.id, name: v.name, number: v.number })) ?? [],
          };
          results.push(node);
        }
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
