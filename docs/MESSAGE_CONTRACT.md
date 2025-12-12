# Webview-Extension Message Contract

This document describes the message protocol between the Project table webview and the VS Code extension for updating field values.

## Overview

The extension supports inline editing of project item fields through a bidirectional message protocol. The webview sends update requests to the extension, which processes them via GraphQL mutations and returns updated data.

## Message Format

### Update Field Value Request

Sent from webview to extension when a user edits a field value.

```typescript
{
  command: "updateFieldValue",
  id?: string,              // Optional message ID for tracking responses
  viewKey: string,          // View identifier (e.g., "project-123:view-0")
  projectId: string,        // GitHub Project V2 ID
  itemId: string,           // Project item ID (content ID)
  fieldId: string,          // Field ID to update
  fieldType: string,        // Field type (see supported types below)
  newValue: any,            // New value (type-specific format)
  value?: any               // Alternative field name (for backward compatibility)
}
```

### Update Response

Sent from extension to webview after processing the update request.

**Success:**
```typescript
{
  command: "updateFieldValueResponse",
  id?: string,              // Echo of request message ID
  success: true
}
```

**Error:**
```typescript
{
  command: "updateFieldValueResponse",
  id?: string,              // Echo of request message ID
  success: false,
  error: string             // Error description
}
```

### Data Refresh

After a successful update, the extension automatically refreshes the project data and sends it back to the webview:

```typescript
{
  command: "fields",
  viewKey: string,
  payload: ProjectSnapshot,    // Updated project data
  effectiveFilter?: string
}
```

## Supported Field Types

### Text Fields

**Type:** `"text"`

**Value Format:**
```typescript
newValue: string
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "text",
  "newValue": "Updated text value"
}
```

**GraphQL Mutation:** `updateProjectV2ItemFieldValue`

### Number Fields

**Type:** `"number"`

**Value Format:**
```typescript
newValue: number
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "number",
  "newValue": 42
}
```

**GraphQL Mutation:** `updateProjectV2ItemFieldValue`

### Date Fields

**Type:** `"date"`

**Value Format:**
```typescript
newValue: string  // ISO 8601 date string (YYYY-MM-DD or full datetime)
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "date",
  "newValue": "2025-01-15"
}
```

**GraphQL Mutation:** `updateProjectV2ItemFieldValue`

### Single Select Fields

**Type:** `"single_select"`

**Value Format:**
```typescript
newValue: string  // Option ID
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "single_select",
  "newValue": "PVTSSFO_lADOABCDzgC"
}
```

**GraphQL Mutation:** `updateProjectV2ItemFieldValue`

### Iteration Fields

**Type:** `"iteration"`

**Value Format:**
```typescript
newValue: string  // Iteration ID
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "iteration",
  "newValue": "PVTI_lADOABCDzgD"
}
```

**GraphQL Mutation:** `updateProjectV2ItemFieldValue`

### Labels

**Type:** `"labels"`

**Value Format:**
```typescript
newValue: {
  labelIds: string[]  // Array of label IDs
}
// OR
newValue: string[]    // Direct array of label IDs
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "labels",
  "newValue": {
    "labelIds": ["MDU6TGFiZWwxMjM", "MDU6TGFiZWw0NTY"]
  }
}
```

**GraphQL Mutation:** `addLabelsToLabelable`

**Note:** Labels are added to existing labels. A future enhancement may support computing the diff to remove labels not in the new set.

### Assignees

**Type:** `"assignees"`

**Value Format:**
```typescript
newValue: {
  assigneeIds: string[]  // Array of user IDs
}
// OR
newValue: string[]       // Direct array of user IDs
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "assignees",
  "newValue": {
    "assigneeIds": ["MDQ6VXNlcjEyMzQ", "MDQ6VXNlcjU2Nzg"]
  }
}
```

**GraphQL Mutation:** `addAssigneesToAssignable`

**Note:** Assignees are added to existing assignees. A future enhancement may support computing the diff to remove assignees not in the new set.

### Reviewers (Pull Requests only)

**Type:** `"reviewers"`

**Value Format:**
```typescript
newValue: {
  userIds?: string[],   // Array of user IDs
  teamIds?: string[],   // Array of team IDs
  reviewerIds?: string[] // Alternative: all treated as userIds
}
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "reviewers",
  "newValue": {
    "userIds": ["MDQ6VXNlcjEyMzQ"],
    "teamIds": ["MDQ6VGVhbTU2Nzg"]
  }
}
```

**GraphQL Mutation:** `requestReviews`

**Note:** Only works on pull request items.

### Milestone

**Type:** `"milestone"`

**Value Format:**
```typescript
newValue: string          // Milestone ID
// OR
newValue: {
  milestoneId: string    // Milestone ID
}
```

**Example:**
```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "milestone",
  "newValue": "MDk6TWlsZXN0b25lMTIzNDU2"
}
```

**GraphQL Mutation:** `updateIssue`

**Note:** Works for both issues and pull requests.

## Clearing Field Values

To clear a field value (set to null/empty), send `null` as the `newValue`:

```json
{
  "command": "updateFieldValue",
  "viewKey": "project-123:view-0",
  "projectId": "PVT_kwDOABCD",
  "itemId": "PVTI_lADOABCDzgA",
  "fieldId": "PVTF_lADOABCDzgB",
  "fieldType": "text",
  "newValue": null
}
```

**GraphQL Mutation:** `clearProjectV2ItemFieldValue`

## Error Handling

### Client-Side (Webview)

The webview should:
1. Show loading/saving state while update is in progress
2. Handle the response message to update UI state
3. On error: display error message and revert to previous value
4. Keep the table interactive even if some updates fail

### Server-Side (Extension)

The extension will:
1. Validate required fields (projectId, itemId, fieldId)
2. Call appropriate GraphQL mutation based on field type
3. Return detailed error messages on failure
4. Log all errors for debugging
5. Automatically refresh project data on success

### Common Errors

- **Missing required fields:** `"Missing required fields: projectId, itemId, or fieldId"`
- **Unsupported field type:** `"Unsupported field type: {type}"`
- **GraphQL errors:** Forwarded from GitHub API (e.g., "Field not found", "Permission denied")
- **Network errors:** Generic connection failures

## Implementation Notes

### MessageHandler (Extension)

Location: `src/webviews/MessageHandler.ts`

The `handleUpdateFieldValue` method:
1. Validates the incoming message
2. Calls `GitHubRepository.getInstance().updateFieldValue()`
3. Sends response to webview
4. On success, refreshes project data via `ProjectDataService.getProjectData()`

### GitHubRepository (Extension)

Location: `src/services/GitHubRepository.ts`

The `updateFieldValue` method:
1. Routes to appropriate private method based on field type
2. Constructs and executes GraphQL mutations
3. Returns `{ success: boolean, error?: string }`

### Backward Compatibility

The implementation supports both `newValue` and `value` field names for the value payload, providing backward compatibility with earlier implementations.

## Testing

### Unit Tests

- `tests/services/GitHubRepository.test.ts`: Tests all field type mutations
- `tests/webviews/MessageHandler.test.ts`: Tests message handling flow

### Integration Tests

- `tests/integration/specs/fieldUpdates.spec.ts`: End-to-end tests covering:
  - Text field updates
  - Single select field updates
  - Error handling
  - Data refresh after updates

## Future Enhancements

1. **Optimistic Updates:** Apply changes immediately in UI before server confirmation
2. **Batch Updates:** Support updating multiple fields in a single request
3. **Diff Computation:** For labels/assignees, compute add/remove diffs instead of just adding
4. **Undo/Redo:** Support reverting field changes
5. **Conflict Resolution:** Handle concurrent edits from multiple users
