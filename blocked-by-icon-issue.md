# Blocked-by sub-icon does not reflect real issue dependencies

## Summary

The project item title field is supposed to show a small "blocked" sub-icon over the main issue/PR icon when the item is blocked by another issue, but this indicator is currently not shown at all. The feature needs to be implemented end-to-end and driven by GitHub’s canonical dependency model.

## Current behavior

- No blocked sub-icon is rendered in the title cell or on related pills (linked PRs, parent issue pill), even when an issue is blocked by another issue on GitHub.
- The GraphQL query for project items does not currently use GitHub’s issue dependency fields to determine blocked-by state.

## Expected behavior

- The blocked sub-icon should appear when, and only when, an issue is _actually_ blocked according to GitHub’s issue dependency graph.
- Specifically, the sub-icon should show when the backing `Issue` node has one or more blocking issues.
- The visual appearance should closely match github.com:
  - Small blocked glyph overlaid at the bottom-right of the main state icon.
  - A circular background that matches the VS Code theme background so it blends into the UI.

## Technical approach

- Use GitHub GraphQL’s canonical dependency fields on `Issue`:
  - `blockedBy: IssueConnection!` – issues blocking this issue.
  - `blocking: IssueConnection!` – issues this issue is blocking.
  - `issueDependenciesSummary: IssueDependenciesSummary!` – summary counts.
- Extend the existing items query to include for `Issue` content:
  - `issueDependenciesSummary { blockedBy totalBlockedBy }`.
- Update the item types used in the extension’s data model to include `issueDependenciesSummary` so it can be surfaced into the webview payload.
- In the webview client’s title renderer:
  - Determine blocked state solely from `content.issueDependenciesSummary.blockedBy > 0`.
  - Remove any heuristics based on labels, status names, field names, or cross-item TRACKS lookups.
- Adjust the sub-icon overlay styling:
  - Position: bottom-right of the base icon, slightly inset.
  - Background: small circular pill using `var(--vscode-editor-background)` to respect the current theme.

## Acceptance criteria

- For an issue that is marked as blocked-by another issue on GitHub:
  - The project item’s title cell shows the blocked sub-icon.
- For an issue that has no blocking dependencies (even if it has a label or status named "Blocked"):
  - The blocked sub-icon does **not** appear.
- Toggling dependencies in GitHub (adding/removing blocking issues) is reflected after a refresh:
  - Adding a blocking dependency causes the sub-icon to appear.
  - Removing all blocking dependencies causes the sub-icon to disappear.
- The blocked sub-icon’s background and position look correct in both light and dark VS Code themes, without overlapping or clipping the main icon.
