# GitHub Projects Lister

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
	- read:project – required to read Projects v2
	- repo – required if you need to read projects linked to private repositories

Notes on scopes:
- The GitHub CLI manual mentions a minimum token scope of “project” for gh project; in VS Code’s authentication provider the equivalent read scope is “read:project”, which is sufficient for reading Projects v2. The “repo” scope is needed for private repo access.

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

## Potential next steps

- Add owner-level browsing (User/Organization `projectsV2`).
- Show more metadata (e.g., visibility, project number, owner).
- Add basic filtering and caching.
