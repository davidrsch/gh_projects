# TODO: GraphQL Mutation Implementation

## Overview

The interactive picker UI is complete and functional. However, the backend integration that persists changes to GitHub via GraphQL mutations needs to be implemented. This document outlines what needs to be done.

## Current State

The `handleUpdateFieldValue` method in `src/webviews/MessageHandler.ts` currently:
- ✅ Validates incoming update requests
- ✅ Logs the update details
- ✅ Sends success/error responses to webview
- ❌ Does NOT persist changes to GitHub (placeholder only)

## Implementation Needed

### Location
File: `src/webviews/MessageHandler.ts`
Method: `handleUpdateFieldValue` (lines ~382-426)

### Required GraphQL Mutations

#### 1. Labels Update

**Mutations:**
```graphql
mutation AddLabelsToLabelable($labelableId: ID!, $labelIds: [ID!]!) {
  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    clientMutationId
  }
}

mutation RemoveLabelsFromLabelable($labelableId: ID!, $labelIds: [ID!]!) {
  removeLabelsFromLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    clientMutationId
  }
}
```

**Implementation Steps:**
1. Get current labels for the item
2. Calculate labels to add (in new set, not in current)
3. Calculate labels to remove (in current set, not in new)
4. Call `addLabelsToLabelable` with labels to add
5. Call `removeLabelsFromLabelable` with labels to remove

**Data Structure:**
```typescript
value: {
  labelIds: string[]  // Array of label IDs to set
}
```

#### 2. Assignees Update

**Mutations:**
```graphql
mutation AddAssigneesToAssignable($assignableId: ID!, $assigneeIds: [ID!]!) {
  addAssigneesToAssignable(input: {assignableId: $assignableId, assigneeIds: $assigneeIds}) {
    clientMutationId
  }
}

mutation RemoveAssigneesFromAssignable($assignableId: ID!, $assigneeIds: [ID!]!) {
  removeAssigneesFromAssignable(input: {assignableId: $assignableId, assigneeIds: $assigneeIds}) {
    clientMutationId
  }
}
```

**Implementation Steps:**
1. Convert login names to user IDs (may need additional query)
2. Get current assignees for the item
3. Calculate assignees to add
4. Calculate assignees to remove
5. Call mutations

**Data Structure:**
```typescript
value: {
  assigneeLogins: string[]  // Array of user login names
}
```

**Note:** You may need to first query for user IDs from login names:
```graphql
query GetUserIds($logins: [String!]!) {
  users(logins: $logins) {
    nodes {
      id
      login
    }
  }
}
```

#### 3. Reviewers Update

**Mutations:**
```graphql
mutation RequestReviews($pullRequestId: ID!, $userIds: [ID!], $teamIds: [ID!]) {
  requestReviews(input: {pullRequestId: $pullRequestId, userIds: $userIds, teamIds: $teamIds}) {
    clientMutationId
  }
}

mutation RemoveReviewRequest($pullRequestId: ID!, $userIds: [ID!], $teamIds: [ID!]) {
  removeReviewRequest(input: {pullRequestId: $pullRequestId, userIds: $userIds, teamIds: $teamIds}) {
    clientMutationId
  }
}
```

**Implementation Steps:**
1. Verify item is a pull request (not an issue)
2. Convert login names to IDs, separating users and teams
3. Get current reviewers
4. Calculate reviewers to add/remove
5. Call mutations

**Data Structure:**
```typescript
value: {
  reviewerLogins: string[]  // Array of user/team login names
}
```

**Challenges:**
- Need to distinguish between users and teams
- Need to handle both types in separate parameters
- Only applicable to pull requests

#### 4. Milestone Update

**Mutations:**

**Option A - Direct Issue/PR Update:**
```graphql
mutation UpdateIssue($issueId: ID!, $milestoneId: ID) {
  updateIssue(input: {id: $issueId, milestoneId: $milestoneId}) {
    clientMutationId
  }
}

mutation UpdatePullRequest($pullRequestId: ID!, $milestoneId: ID) {
  updatePullRequest(input: {id: $pullRequestId, milestoneId: $milestoneId}) {
    clientMutationId
  }
}
```

**Option B - Project Field Update:**
```graphql
mutation UpdateProjectV2ItemFieldValue(
  $projectId: ID!,
  $itemId: ID!,
  $fieldId: ID!,
  $value: ProjectV2FieldValue!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId,
    itemId: $itemId,
    fieldId: $fieldId,
    value: $value
  }) {
    clientMutationId
  }
}
```

**Implementation Steps:**
1. Determine if milestone is a project field or native field
2. Choose appropriate mutation
3. For project field: Use `updateProjectV2ItemFieldValue`
4. For native field: Determine item type (Issue/PR) and use appropriate mutation

**Data Structure:**
```typescript
value: {
  milestoneId: string | null  // Milestone ID, or null to clear
}
```

## Implementation Strategy

### 1. Create Mutation Helper Service

Consider creating a new service class:

```typescript
// src/services/FieldUpdateService.ts

export class FieldUpdateService {
  async updateLabels(itemId: string, labelIds: string[]): Promise<void> {
    // Implementation
  }

  async updateAssignees(itemId: string, assigneeLogins: string[]): Promise<void> {
    // Implementation
  }

  async updateReviewers(pullRequestId: string, reviewerLogins: string[]): Promise<void> {
    // Implementation
  }

  async updateMilestone(itemId: string, milestoneId: string | null): Promise<void> {
    // Implementation
  }
}
```

### 2. Update MessageHandler

Replace the TODO placeholder in `handleUpdateFieldValue`:

```typescript
private async handleUpdateFieldValue(msg: any) {
  try {
    const reqViewKey = (msg as any).viewKey as string | undefined;
    const itemId = (msg as any).itemId;
    const fieldId = (msg as any).fieldId;
    const value = (msg as any).value;

    if (!reqViewKey || !itemId || !fieldId) {
      logger.error("updateFieldValue: missing required parameters");
      return;
    }

    // Determine field type and call appropriate update method
    const field = this.getFieldById(fieldId);
    if (!field) {
      throw new Error(`Field ${fieldId} not found`);
    }

    const updateService = new FieldUpdateService();

    switch (field.type) {
      case "labels":
        await updateService.updateLabels(itemId, value.labelIds);
        break;
      case "assignees":
        await updateService.updateAssignees(itemId, value.assigneeLogins);
        break;
      case "reviewers":
        await updateService.updateReviewers(itemId, value.reviewerLogins);
        break;
      case "milestone":
        await updateService.updateMilestone(itemId, value.milestoneId);
        break;
      default:
        throw new Error(`Unsupported field type: ${field.type}`);
    }

    // Send success response
    this.panel.webview.postMessage({
      command: "fieldUpdateSuccess",
      viewKey: reqViewKey,
      itemId,
      fieldId,
    });

    // Optionally refresh data to ensure consistency
    // await this.handleRequestFields({ viewKey: reqViewKey });

  } catch (e) {
    // Error handling...
  }
}
```

### 3. Add Rollback Support

When an update fails, the UI should revert to the previous state:

```typescript
// In ProjectTable.ts handleFieldUpdate
private async handleFieldUpdate(itemId: string, fieldId: string, value: any): Promise<void> {
  // Save current state before update
  const item = this.items.find((i) => String(i.id) === String(itemId));
  const fieldValue = item?.fieldValues.find(/* ... */);
  const previousValue = fieldValue ? { ...fieldValue } : null;

  try {
    // Optimistically update UI
    // ... existing code ...

    // Send update to backend
    // ... existing code ...

  } catch (error) {
    // Rollback on error
    if (previousValue && fieldValue) {
      Object.assign(fieldValue, previousValue);
      this.render();
    }
    throw error;
  }
}
```

## Testing Requirements

### Unit Tests
- Test each mutation helper method
- Mock GraphQL responses
- Test error handling

### Integration Tests
- Test actual GitHub API calls (with test repository)
- Verify optimistic updates work correctly
- Verify rollback on failure

### Manual Testing
- Test each picker type in real project
- Verify changes persist after refresh
- Test error scenarios (network issues, permission errors)

## Additional Considerations

### Rate Limiting
- GitHub API has rate limits
- Consider batching updates if multiple fields changed
- Add delay/debounce for rapid changes

### Permissions
- Check if user has permission to modify field
- Handle permission errors gracefully
- Disable picker for read-only fields

### Conflict Resolution
- Handle case where item was modified by another user
- Consider adding optimistic locking
- Show conflict dialog if needed

### Offline Support
- Queue updates when offline
- Sync when connection restored
- Show pending state in UI

## References

- [GitHub GraphQL API - Mutations](https://docs.github.com/en/graphql/reference/mutations)
- [GitHub GraphQL API - Objects](https://docs.github.com/en/graphql/reference/objects)
- [Projects V2 GraphQL API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)

## Timeline Estimate

- Basic mutation implementation: 2-3 days
- Error handling and rollback: 1 day
- Testing: 2 days
- Permission handling: 1 day
- **Total: ~1 week**

## Priority

**HIGH** - The pickers are functional in the UI but changes don't persist without this implementation.
