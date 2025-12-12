# Interactive Table Cells

This document describes the implementation of interactive single-select and iteration cells in the Project table view.

## Overview

Users can now directly edit single-select and iteration field values by clicking on cells in the Project table view. The implementation provides dropdown-style UIs similar to GitHub Projects, with full keyboard navigation support.

## Architecture

### Components

#### 1. FieldDropdown (`src/webviews/client/components/FieldDropdown.ts`)

A reusable dropdown component for field value selection.

**Features:**
- Displays a list of options with labels, descriptions, and color swatches
- Supports keyboard navigation (Up/Down arrows, Enter, Escape)
- Automatically positions relative to anchor element
- Handles viewport overflow (flips above if needed)
- Shows "Clear" option to unset values

**Usage:**
```typescript
const dropdown = new FieldDropdown({
  options: [
    { id: null, label: "Clear" },
    { id: "1", label: "Option 1", color: "#ff0000", description: "..." }
  ],
  currentValue: "1",
  anchorElement: cellElement,
  onSelect: (optionId) => { /* handle selection */ },
  onClose: () => { /* cleanup */ },
  title: "Select Option",
  emptyMessage: "No options configured"
});
dropdown.show();
```

#### 2. InteractiveCellManager (`src/webviews/client/components/InteractiveCellManager.ts`)

Manages interactive behavior for table cells.

**Responsibilities:**
- Attaches click and keyboard handlers to cells
- Opens dropdowns when cells are clicked or activated via keyboard
- Handles update requests and responses
- Manages loading states and error display
- Prevents concurrent updates on the same cell

**Usage:**
```typescript
const manager = new InteractiveCellManager({
  onUpdateRequest: async (request) => {
    // Send update to backend
  },
  onUpdateSuccess: (request) => {
    // Refresh table
  },
  onUpdateError: (request, error) => {
    // Handle error
  }
});

// Attach to cells during rendering
manager.attachToCell(cellElement, field, item, currentValue, projectId, viewKey);
```

#### 3. ProjectTable Integration

The `ProjectTable` component has been updated to:
- Accept `projectId` and `onFieldUpdate` options
- Initialize `InteractiveCellManager` when field updates are enabled
- Pass cell rendering callback to `RowRenderer`
- Automatically attach interactive behavior to single-select and iteration cells

#### 4. RowRenderer Integration

The `RowRenderer` has been updated to:
- Accept an optional `onCellRendered` callback
- Invoke the callback after rendering each cell
- Allow parent components to attach post-render behavior

### Backend Flow

#### Message Handler (`src/webviews/MessageHandler.ts`)

New message command: `updateFieldValue`

**Request:**
```typescript
{
  command: "updateFieldValue",
  itemId: string,
  fieldId: string,
  value: string | null,  // optionId or iterationId, null to clear
  projectId: string,
  viewKey: string
}
```

**Process:**
1. Validates required fields
2. Fetches current snapshot to determine field type
3. Builds appropriate GraphQL mutation input:
   - Single-select: `{ singleSelectOptionId: value }`
   - Iteration: `{ iterationId: value }`
   - Clear: `{ text: "" }`
4. Executes `updateProjectV2ItemFieldValue` mutation
5. Refreshes project snapshot with updated data
6. Returns updated snapshot to webview

**Response:**
```typescript
{
  command: "updateFieldValueResult",
  success: boolean,
  error?: string,
  viewKey: string,
  payload?: ProjectSnapshot,
  effectiveFilter?: string
}
```

### Webview Integration (`src/webviews/client/tableViewFetcher.ts`)

The table view fetcher passes the `onFieldUpdate` callback to `ProjectTable`:

```typescript
const table = new ProjectTable(container, fields, items, {
  projectId: snapshot.project?.id,
  onFieldUpdate: async (request) => {
    // Post message to extension
    window.__APP_MESSAGING__.postMessage({
      command: "updateFieldValue",
      ...request
    });
    
    // Wait for response
    return new Promise((resolve, reject) => {
      // Handle updateFieldValueResult message
    });
  },
  // ... other options
});
```

## Field Types

### Single-Select Fields

**Display:**
- Pill-styled rendering with border color matching option color
- Shows option name
- Tooltip displays option name and description (if available)

**Selection:**
- Click cell or press Enter/Space to open dropdown
- Dropdown shows all options from `field.options`
- Each option displays:
  - Color swatch (16x16px, border-radius 3px)
  - Option name
  - Optional description
- Current selection is highlighted
- "Clear" option at top to unset value

**Update:**
- On selection, posts `updateFieldValue` with `singleSelectOptionId`
- Cell shows loading state during update
- On success, table re-renders with new value
- On error, shows error tooltip for 3 seconds

### Iteration Fields

**Display:**
- Pill-styled rendering similar to single-select
- Shows iteration title
- Tooltip displays name and date range (start - end)

**Selection:**
- Click cell or press Enter/Space to open dropdown
- Dropdown shows all iterations from `field.configuration.iterations`
- Each iteration displays:
  - Title
  - Date range (e.g., "Jan 1 - Jan 14")
- Current selection is highlighted
- "No iteration" / "Clear" option at top to unset

**Update:**
- On selection, posts `updateFieldValue` with `iterationId`
- Same loading/success/error handling as single-select

## Edge Cases

### No Options/Iterations Configured

- Single-select: Dropdown shows "No options configured" message
- Iteration: Dropdown shows "No iterations configured" message
- "Clear" option is still available

### Concurrent Updates

- If a cell is already being updated, clicks/keyboard events are ignored
- Cell shows loading state (`opacity: 0.6`, `pointer-events: none`)
- Only one update per cell at a time

### Empty/Missing Values

- Empty cells are clickable and show dropdown
- Selecting "Clear" sends `value: null` to clear the field
- Backend interprets null as clear operation

### Viewport Overflow

- Dropdown automatically flips above anchor if not enough space below
- Horizontal position adjusts to stay within viewport
- Dropdown repositions on window scroll/resize

### Error Handling

- Network errors show error tooltip on cell
- Invalid field types fall back to text update
- Timeout after 10 seconds returns error
- Errors are logged to extension output channel

## Keyboard Navigation

### Opening Dropdown

- **Enter** or **Space**: Open dropdown for focused cell
- Cell must be focused (via Tab or click)

### Within Dropdown

- **Arrow Down**: Move to next option
- **Arrow Up**: Move to previous option
- **Enter**: Select highlighted option
- **Escape**: Close dropdown without selecting

### Accessibility

- Cells have `tabIndex="0"` for keyboard focus
- Dropdowns have `tabIndex="0"` for focus management
- Hover states provide visual feedback
- Loading states prevent accidental interactions

## Styling

All components use VS Code theme variables for consistent appearance:

- `--vscode-menu-background`: Dropdown background
- `--vscode-menu-border`: Dropdown border
- `--vscode-menu-foreground`: Text color
- `--vscode-menu-selectionBackground`: Selection highlight
- `--vscode-focusBorder`: Focus outline
- `--vscode-errorForeground`: Error indication
- `--vscode-list-hoverBackground`: Hover states

## Testing

### Unit Tests

`tests/webviews/client/components/FieldDropdown.test.ts`

Tests cover:
- Dropdown creation and rendering
- Option display with colors
- Current selection highlighting
- Click selection
- Keyboard navigation (arrows, Enter, Escape)
- Backdrop dismissal
- Empty state handling

### Manual Testing Checklist

- [ ] Single-select dropdown appears on cell click
- [ ] Single-select dropdown shows correct options with colors
- [ ] Selecting option updates the cell value
- [ ] Clear option removes the value
- [ ] Iteration dropdown shows date ranges
- [ ] Keyboard navigation works (Up/Down/Enter/Esc)
- [ ] Loading state appears during update
- [ ] Success updates the table
- [ ] Errors show tooltip and revert
- [ ] Dropdown positions correctly near viewport edges
- [ ] Multiple rapid clicks don't cause issues
- [ ] Dropdowns close when clicking elsewhere

## Future Enhancements

Potential improvements for future iterations:

1. **Search/Filter**: Add search box for fields with many options
2. **Recently Used**: Show recently selected options at top
3. **Bulk Edit**: Select multiple cells and edit at once
4. **Undo**: Add undo capability for quick reversals
5. **Optimistic Updates**: Update UI immediately, revert on error
6. **Other Field Types**: Extend to text, number, date fields
7. **Validation**: Client-side validation before sending update
8. **Autocomplete**: For text fields with suggested values

## References

- [GitHub Projects API - updateProjectV2ItemFieldValue](https://docs.github.com/en/graphql/reference/mutations#updateprojectv2itemfieldvalue)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [ProjectV2 Field Types](https://docs.github.com/en/graphql/reference/enums#projectv2fieldtype)
