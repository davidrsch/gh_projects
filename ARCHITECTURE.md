# ghProjects Architecture Documentation

## Overview

ghProjects is a VS Code extension that discovers GitHub Projects (Projects v2) linked to repositories in the user's workspace and provides a UI for viewing and managing them.

## Extension Activation Flow

### 1. Activation (`src/extension.ts`)

**Entry point**: `activate(context: vscode.ExtensionContext)`

**Key responsibilities**:
- Initialize project service and chat participant
- Select workspace folder (or prompt user if multiple folders)
- Create tree view provider
- Register commands:
  - `ghProjects.refresh` - Refresh projects list
  - `ghProjects.signIn` - Sign in to GitHub
  - `ghProjects.openProject` - Open project webview
  - `ghProjects.testTableQueries` - Test table queries
- Listen for workspace folder changes
- Perform initial authentication check

**Dependencies**:
- `ProjectsProvider` for tree view
- `ProjectService` for project discovery
- `AuthenticationManager` for GitHub authentication
- `openProjectWebview` for webview hosting

### 2. Project Discovery Flow

**Sequence**:
1. User opens workspace → Extension activates
2. `ProjectsProvider.refresh()` called
3. `ProjectService.loadProjects(workspaceRoot)` initiated
4. Git repository discovery via `findGitRepos(workspaceRoot, maxDepth)`
5. Remote extraction via `getRemotesForPath(repoPath)` for each repo
6. Parse GitHub remotes to get owner/repo
7. Query GitHub GraphQL API via `GitHubRepository.getProjects(owner, name)`
8. Aggregate and deduplicate projects
9. Fetch project views via `GitHubRepository.fetchProjectViews(projectId)`
10. Display in tree view

**Key modules**:

#### `src/treeView/findRepos.ts`
- Recursively scans workspace for `.git` folders/files
- Respects maxDepth configuration
- Skips `node_modules` directories
- Returns array of `Repo` objects with path and git type

#### `src/treeView/getRemotes.ts`
- Executes `git remote -v` for a repository
- Parses output to extract remote name, URL, and type (fetch/push)
- Returns array of `Remote` objects

#### `src/services/projectService.ts`
- Orchestrates project discovery
- Uses `promisePool` for concurrent operations
- Filters for GitHub remotes
- Calls `GitHubRepository` for GraphQL queries
- Aggregates results via `uniqueProjectsFromResults`

#### `src/treeViewProvider.ts`
- Implements `vscode.TreeDataProvider`
- Manages tree view state
- Shows progress during project loading
- Handles errors with user-friendly messages

## GitHub Data Layer

### AuthenticationManager (`src/services/AuthenticationManager.ts`)
- Singleton pattern
- Wraps VS Code authentication API
- Requests scopes: `repo`, `read:project`, `read:org`, `read:user`
- Provides `ensureAuthenticated()` and `getSession()` methods

### GitHubRepository (`src/services/GitHubRepository.ts`)
- Singleton pattern
- Main interface to GitHub GraphQL API
- Key methods:
  - `getProjects(owner, name)` - Fetch projects for a repo
  - `fetchProjectViews(projectId)` - Fetch views for a project
  - `fetchProjectFields(projectId, options)` - Fetch full project data including fields and items
  
**Current issues**:
- Large, complex methods mixing query building, execution, and normalization
- Difficult to test in isolation
- Error handling inconsistent

### ProjectDataService (`src/services/ProjectDataService.ts`)
- Static service for fetching and processing project data
- Main method: `getProjectData(project, viewKey, forceRefresh)`
- Responsibilities:
  - Parse view key to determine which view to load
  - Fetch project snapshot via `GitHubRepository.fetchProjectFields()`
  - Apply view-specific field filtering and ordering
  - Preserve original fields as `allFields` for client-side show/hide

**Current issues**:
- Complex field filtering/reordering logic
- Mixes data fetching with view processing

## Webview Layer

### Host Layer (Extension Side)

#### `src/webviews/projectDetails.ts`
- Main entry point for opening project webviews
- Flow:
  1. Fetch project views via `ViewDataService.fetchProjectViews()`
  2. Enrich view details via `ViewDataService.enrichViewDetails()`
  3. Create or reveal panel via `PanelManager`
  4. Build HTML via `buildHtml()`
  5. Attach message handler via `MessageHandler`

#### `src/webviews/PanelManager.ts`
- Singleton pattern
- Manages webview panel lifecycle
- Tracks open panels by key (workspaceRoot + projectId)
- Methods:
  - `getPanel(key)` - Get existing panel
  - `createPanel(context, project, key)` - Create new panel
  - `getWebviewContent()` - **INCOMPLETE** placeholder implementation

**Current issues**:
- `getWebviewContent()` method is incomplete (returns empty string)
- Unclear separation of concerns with `projectDetails.ts`

#### `src/webviews/MessageHandler.ts`
- Handles bidirectional communication between extension and webview
- Message types:
  - `ready` - Webview ready for data
  - `refresh` - Refresh project data
  - `viewChange` - User switched view
  - `filterChange` - User changed filters
  - `groupChange` - User changed grouping
  - And more...
- Uses `ViewDataService` for data operations

#### `src/webviews/ViewDataService.ts`
- Static service for view-related operations
- Methods:
  - `fetchProjectViews(project)` - Fetch views from GitHubRepository
  - `enrichViewDetails(context, project, views)` - Fetch view details (fields, filters)
  - `getViewData(project, viewKey, forceRefresh)` - Get data for specific view

#### `src/webviews/webviewUtils.ts`
- Utility functions for webview resource resolution
- `getWebviewFolder(context)` - Determine if using bundled or unbundled scripts
- `getWebviewResources(context, webview, folder)` - Build resource URIs

#### `src/webviews/htmlBuilder.ts`
- Builds initial HTML for webview
- Includes scripts, styles, and initial state
- Sets up message passing infrastructure

### Client Layer (Webview Side)

Located in `src/webviews/client/`:

#### View Fetchers
- `tableViewFetcher.ts` - Table view rendering
- `boardViewFetcher.ts` - Board/kanban view rendering
- `roadmapViewFetcher.ts` - Roadmap/timeline view rendering
- `overviewFetcher.ts` - Overview rendering
- `contentFetcher.ts` - Content selection logic

**Pattern**: Each fetcher is responsible for:
1. Receiving project data from extension
2. Filtering and grouping items
3. Rendering view-specific UI
4. Handling user interactions

#### Components
- `ProjectTable.ts` - Main table component
- `ColumnHeaderMenu.ts` - Column header with sorting/filtering
- `FieldsMenu.ts` - Fields visibility menu
- `SlicePanel.ts` - Grouping/slicing panel
- `TableResizer.ts` - Table column resizing

#### Renderers
- `cellRenderer.ts` - Render individual cells
- `columnHeaderRenderer.ts` - Render column headers
- `RowRenderer.ts` - Render table rows
- `GroupRenderer.ts` - Render grouped views
- `strategies.ts` - Rendering strategies for different field types

#### Services
- `GroupDataService.ts` - Grouping and aggregation logic

#### Utilities
- `filterLogic.ts` - Filter matching logic
- `tableSorting.ts` - Sorting algorithms
- `domUtils.ts` - DOM manipulation helpers
- `storage.ts` - Local storage wrapper
- `logger.ts` - Client-side logging

#### Icon Registry (`src/webviews/client/icons/`)
**Purpose**: Centralized management of all GitHub-style Octicon icons used in webviews

**Key files**:
- `iconRegistry.ts` - Core icon definitions and helper functions
- `../iconHelper.ts` - Exposes registry to browser window

**Features**:
- **Type-safe icon names**: `IconName` union type ensures valid references
- **Official GitHub SVGs**: Uses authentic Octicons path data (16x16 viewBox)
- **Consistent styling**: All icons use `fill="currentColor"` for theme integration
- **Accessibility**: Automatic `aria-hidden="true"` and `focusable="false"` attributes
- **Helper functions**:
  - `getIconSvg(name, options?)` - Returns inline SVG string
  - `createIconElement(name, options?)` - Returns DOM element
  - `getIconNameForDataType(dataType)` - Maps field data types to icon names

**Available icons** (30+):
- View layouts: `table`, `project`, `board`, `roadmap`
- Field types: `list`, `people`, `tag`, `single-select`, `issue-tracks`, `issue-tracked-by`, `iterations`, `number`, `calendar`, `pull-request`, `milestone`, `repo`, `typography`
- Actions: `sort-asc`, `sort-desc`, `rows`, `sliceby`, `eye-closed`, `arrow-left`, `arrow-right`, `triangle-down`, `triangle-right`, `note`

**Usage pattern**:
```typescript
// TypeScript modules can import directly
import { getIconSvg, IconName } from './icons/iconRegistry';

// Browser window access (via iconHelper.ts)
window.getIconSvg('table', { size: 16 });
window.getIconNameForDataType('assignees'); // returns 'people'
```

**Components using icon registry**:
- `htmlHelpers.ts` - View tab icons
- `FieldsMenu.ts` - Field type icons
- `SlicePanel.ts` - Slice field icons
- `ColumnHeaderMenu.ts` - Sort/action icons
- `columnHeaderRenderer.ts` - Group/slice indicators
- `GroupRenderer.ts` - Expand/collapse icons

**Current issues**:
- Shared behaviors (filtering, grouping, view handling) spread across multiple modules
- Inconsistent interfaces between fetchers
- Duplication of filter/group logic

## Configuration

Settings (`package.json` contributions):
- `ghProjects.maxDepth` (default: 4) - Scanning depth for finding git repos
- `ghProjects.itemsFirst` (default: 50) - Items to fetch per query
- `ghProjects.maxConcurrency` (default: 4) - Max concurrent operations
- `ghProjects.queryTimeoutMs` (default: 30000) - GraphQL query timeout
- `ghProjects.useHttpApi` (deprecated)
- `ghProjects.preferHttp` (default: true) - Use HTTP GraphQL
- `ghProjects.useBundledWebviews` (default: false) - Use bundled scripts
- `ghProjects.debug` (default: false) - Enable debug logging
- `ghProjects.devMode` (default: false) - Developer mode

## Logging

### Extension-side logging
- `src/lib/logger.ts` - Centralized logger
- Writes to "ghProjects" output channel
- Levels: debug, info, warn, error
- Respects `ghProjects.debug` configuration

### Client-side logging
- `src/webviews/client/utils/logger.ts` - Webview logger
- Sends messages back to extension via postMessage
- Levels: debug, info, warn, error

## Testing

### Unit Tests
- Jest with ts-jest preset
- Node environment for most tests
- jsdom environment for webview client tests
- Mocks VS Code API and external dependencies
- 16 test suites, 62 tests currently passing

**Coverage**:
- ✅ GitHubRepository
- ✅ Authentication
- ✅ Webview components (ProjectTable, ColumnHeaderMenu)
- ✅ Utilities (filtering, sorting, parsing)
- ✅ HTML building
- ❌ ProjectService
- ❌ ProjectsProvider
- ❌ MessageHandler
- ❌ ViewDataService

### Integration Tests
- Playwright-based UI tests
- Located in `tests/integration/`
- Test webview interactions, view switching, filtering, etc.
- **Currently not running** (missing dependencies: playwright, dotenv, @vscode/test-electron)

## Build & Distribution

### Compilation
- TypeScript compiled to `out/` directory
- Main entry: `out/src/extension.js`
- `tsc -p ./` compiles both src and tests (excluding integration)

### Webview Bundling
- `npm run build:webviews` - Bundles client scripts with esbuild
- Output to `media/dist/`
- Can serve unbundled scripts from `media/webviews/` in dev mode

### Linting
- ESLint 9.x (migration from .eslintrc.cjs to eslint.config.js needed)
- Falls back to Prettier on ESLint failure
- Runs `--fix` automatically

## Critical Code Paths

### 1. Extension Activation → Project Display
```
activate() 
  → ProjectService.loadProjects()
    → findGitRepos()
    → getRemotesForPath()
    → GitHubRepository.getProjects()
    → GitHubRepository.fetchProjectViews()
  → ProjectsProvider.refresh()
  → Tree view updated
```

### 2. Opening Project Details
```
User clicks project in tree
  → command "ghProjects.openProject"
  → openProjectWebview()
    → ViewDataService.fetchProjectViews()
    → ViewDataService.enrichViewDetails()
    → PanelManager.createPanel()
    → buildHtml()
    → MessageHandler.attach()
  → Webview displays
```

### 3. Webview Data Loading
```
Webview sends "ready" message
  → MessageHandler receives
  → ViewDataService.getViewData()
    → ProjectDataService.getProjectData()
      → GitHubRepository.fetchProjectFields()
    → Apply view filtering/ordering
  → Send data to webview
  → Client fetcher renders view
```

### 4. View Switching
```
User selects different view
  → Client sends "viewChange" message
  → MessageHandler receives
  → ViewDataService.getViewData(newViewKey)
  → Send updated data
  → Client re-renders
```

### 5. Filtering/Grouping
```
User changes filter/group
  → Client sends filter/group state
  → Client-side re-render (no round-trip to extension)
  → Filter/group state persisted in webview
```

## Identified Issues

### Architecture
1. Tight coupling between VS Code APIs, services, and GraphQL layer
2. Complex multi-responsibility methods in GitHubRepository and ProjectDataService
3. Webview resource resolution split across multiple modules
4. PanelManager has incomplete implementation

### Code Quality
1. Large methods that mix concerns (query building, execution, normalization)
2. Inconsistent error handling
3. Duplication in client-side filter/group logic
4. No clear abstraction boundaries

### Testing
1. Missing tests for ProjectService, ProjectsProvider, MessageHandler
2. Integration tests not runnable without additional setup
3. Some modules difficult to test due to tight coupling

### Configuration
1. ESLint migration needed (v8 → v9)
2. Multiple overlapping settings for webview mode
3. Configuration handling spread across modules

## Refactoring Progress

The codebase is undergoing a phased refactor to improve structure, maintainability, and testability. Key improvements made:

### Completed Improvements

#### Configuration Management (`src/lib/config.ts`)
- **ConfigReader interface**: Abstraction for dependency injection and testing
- **VSCodeConfigReader**: Clean wrapper around VS Code configuration API
- **Benefits**: Services no longer directly depend on vscode.workspace, improving testability

#### Repository Discovery (`src/services/repositoryDiscovery.ts`)
- **Extracted from ProjectService**: Separated GitHub repo extraction logic
- **GitHubRepo type**: Clear interface for owner/repo pairs
- **extractGitHubRepos function**: Handles remote parsing and fallback to git commands
- **Benefits**: Single responsibility, easier to test, reusable across services

#### GraphQL Execution (`src/services/graphqlExecutor.ts`)
- **GraphQLExecutor interface**: Abstraction for query execution
- **GitHubGraphQLExecutor**: Implementation using @octokit/graphql
- **Benefits**: GitHubRepository no longer directly coupled to graphql library, easier mocking

#### ProjectService Refactoring
- **Uses ConfigReader**: No direct VS Code API dependencies
- **Uses repositoryDiscovery**: Cleaner separation of concerns
- **Improved testability**: Now has comprehensive test coverage (5 tests)

#### Dead Code Removal
- **PanelManager.getWebviewContent**: Removed incomplete, unused method
- **Cleaner interfaces**: Removed misleading incomplete implementations

### Architectural Principles

Key principles applied during refactoring:
- **Incremental changes** - Small, testable commits
- **Tests first** - Lock in behavior before refactoring (18 test suites, 75 tests)
- **Preserve public APIs** - No breaking changes to commands, tree view, or message contracts
- **Improve layering** - Clearer separation between extension, services, and UI
- **Dependency injection** - Interfaces for testability (ConfigReader, GraphQLExecutor)
- **Single responsibility** - Smaller, focused modules
- **Document** - Clear intent through code structure and comments
