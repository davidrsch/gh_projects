# GitHub Projects Lister

Shows a dedicated Activity Bar view with a custom icon. The tree displays “Projects”.

## Commands

- Activity Bar view: Click the “Github Projects” icon to open the “Projects” tree.
- Command: `GitHub: Refresh Projects` – Refreshes the tree.

## Setup

1. Click the “Github Projects” icon in the Activity Bar to open the tree.

## Notes

- Detection and querying logic has been removed per request; the view shows the “Projects” tree UI only.

## Development

Compile: `npm run compile`
Watch: `npm run watch`

## Future Enhancements (Out of Scope)

- Also surface org/user Projects v2 that include items from the repo (requires scanning project items).
- Caching results.
- Filtering by project state.
