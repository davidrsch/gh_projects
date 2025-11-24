# GitHub Projects

Browse GitHub Projects (Projects v2) linked to repositories in your current workspace. The extension scans for local Git repositories, detects GitHub remotes, fetches repository-linked projects via GitHub GraphQL, and lists them in a dedicated Activity Bar view. Click a project to open it in your browser.

## What it shows

- One Activity Bar view named “Projects” with a custom icon.
- A flat list of unique Projects v2 linked to any GitHub repositories found under your workspace folders.
- Each entry shows the project title and URL; clicking opens the project on github.com.

## Commands

- Activity Bar: Click the “Github Projects” icon to open the Projects view.
- Command Palette: “GitHub: Refresh Projects” to rescan repos and re-fetch projects.

## Requirements

- Sign in to GitHub in VS Code when prompted. The extension requests these scopes:

- Sign in to GitHub in VS Code when prompted. The extension requests these scopes:
	- read:project – required to read Projects v2
	- repo – required if you need to read projects linked to private repositories
	- read:org – read organization membership and org-level data
	- read:user – read basic user profile information

Notes on scopes:
- The GitHub CLI manual mentions a minimum token scope of “project” for gh project; in VS Code’s authentication provider the equivalent read scope is “read:project”, which is sufficient for reading Projects v2. The “repo” scope is needed for private repo access.

## Signing in

- The extension uses VS Code's Authentication API. You must sign in to GitHub through VS Code to enable authenticated features.
- Use the Command Palette and run `ghProjects.signIn` or click the "Sign in to GitHub" action when prompted.
- Required scopes: `repo`, `read:org`, `read:user`. The extension will request these when signing in.

**Authentication (No Fallback)**

- This extension uses ONLY the VS Code Authentication API (`vscode.authentication.getSession`) for authenticated requests. It will never read tokens from environment variables, local files, or the `gh` CLI. There is no fallback to `GH_TOKEN`, `gh`, or other non-interactive mechanisms. You must sign in via VS Code for authenticated features to work.

## Migration from PATs or CLI-based workflows

- This extension no longer reads `GH_TOKEN` or `ghProjects.ghToken` configuration and uses HTTP GraphQL via the VS Code Authentication API. The extension does not invoke the `gh` CLI.
- If you previously used a Personal Access Token or the `gh` CLI, switch to VS Code built-in GitHub sign-in:
	1. Open the Command Palette (Ctrl+Shift+P) and run `Sign in to GitHub` (or `ghProjects.signIn`).
	2. Complete the OAuth flow in the browser. If your organization uses SAML/SSO, follow the enterprise guidance presented by the sign-in flow.

If you need to automate data access, consider using CI runners with appropriate environment tokens outside of this extension's interactive sign-in flow.

## How to use

1. Open a folder or workspace that contains one or more Git repositories.
2. Open the “Github Projects” view from the Activity Bar. If you haven’t already, sign in to GitHub when prompted.
3. Use “GitHub: Refresh Projects” to rescan and refresh the list.
4. Click any project in the list to open it in your default browser.

## What’s included under the hood

- Git discovery: Recursively finds local Git repositories under your workspace folders and reads remotes from `.git/config`.
- GitHub detection: Parses remote URLs (SSH/HTTPS/scp-like) and filters for GitHub-like hosts.
- GraphQL: Uses `@octokit/graphql` to query `repository.projectsV2` and aggregates results across all repos (with limited concurrency).
- De-duplication: Projects are unique by GraphQL id across all repos scanned.

Current limitation:
- Only repository-linked projects are shown. User/org-level projects not linked to repos are not listed yet.

## Privacy

No data is stored. The extension reads local `.git` config to detect remotes and queries the GitHub GraphQL API to fetch project metadata. Output logs are shown only in the VS Code Output panel.

## Development

- Build once: npm run compile
- Watch mode: npm run watch
- Lint: npm run lint (if configured)

## Configuration

- `ghProjects.preferHttp` (boolean, default `true`): Prefer HTTP GraphQL using the VS Code GitHub authentication session. The extension uses HTTP GraphQL exclusively; sign-in will be required.

Note: The extension no longer falls back to the GitHub CLI and does not rely on `gh` being installed.

## Potential next steps

- Add owner-level browsing (User/Organization `projectsV2`).
- Show more metadata (e.g., visibility, project number, owner).
- Add basic filtering and caching.

## Third-party assets

Third-party assets used by webviews are placed under `media/third-party/`.

Attribution:
- `vscode-elements.js` (VS Code Elements) is included in `media/third-party/` with upstream attribution in `media/third-party/README.md`.

See `media/third-party/README.md` for license and source details.
