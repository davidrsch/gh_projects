# Accessibility and Keyboard Navigation

This document describes the accessibility features and keyboard navigation support in the GitHub Projects extension.

## Table of Contents

- [Keyboard Navigation](#keyboard-navigation)
- [Screen Reader Support](#screen-reader-support)
- [Visual Accessibility](#visual-accessibility)
- [Testing Accessibility](#testing-accessibility)

## Keyboard Navigation

### Table Cell Navigation

Navigate between table cells using arrow keys:

| Key | Action |
|-----|--------|
| `↑` Arrow Up | Move focus to cell above |
| `↓` Arrow Down | Move focus to cell below |
| `←` Arrow Left | Move focus to cell on the left |
| `→` Arrow Right | Move focus to cell on the right |
| `Tab` | Move forward through interactive elements |
| `Shift + Tab` | Move backward through interactive elements |

### Editing Cells

Interact with editable cells (single-select, iteration, etc.):

| Key | Action |
|-----|--------|
| `Enter` | Open dropdown/picker for editable cells |
| `F2` | Open dropdown/picker for editable cells |
| `Space` | Open dropdown/picker for interactive cells |
| `Escape` | Cancel edit and close dropdown |

### Dropdown/Picker Navigation

When a dropdown or picker is open:

| Key | Action |
|-----|--------|
| `↑` Arrow Up | Move to previous option |
| `↓` Arrow Down | Move to next option |
| `Enter` | Select highlighted option |
| `Space` | Select/toggle highlighted option |
| `Escape` | Close dropdown without selecting |

### Column Operations

Interact with column headers:

| Key | Action |
|-----|--------|
| `Tab` | Focus on column menu button |
| `Enter` | Open column menu |
| `Space` | Open column menu |

## Screen Reader Support

### Table Structure

The table is marked up with appropriate ARIA roles and attributes:

- **Table**: `role="grid"` with `aria-label` describing the table
- **Header Row**: `role="row"` in `<thead>` with `role="rowgroup"`
- **Column Headers**: `role="columnheader"` with `aria-label` and `scope="col"`
- **Data Rows**: `role="row"` with `aria-rowindex`
- **Cells**: `role="gridcell"` with `aria-colindex` and descriptive labels

### Sorted Columns

When a column is sorted, the header includes:
- `aria-sort="ascending"` or `aria-sort="descending"`

### Editable Cells

Cells that can be edited include:
- `aria-readonly="false"` for editable cells
- `aria-readonly="true"` for read-only cells

### Dropdown Menus

Dropdown menus and pickers include:
- `role="listbox"` for the container
- `role="option"` for each option
- `aria-label` with descriptive text
- `aria-selected` to indicate current selection
- `aria-activedescendant` to track keyboard focus

## Visual Accessibility

### Focus Indicators

All interactive elements have visible focus indicators:

- **Cells**: 2px solid outline using theme focus color
- **Interactive cells**: Additional hover state with background color
- **Dropdown options**: Background color change on focus
- **Buttons**: Outline with offset for clarity

### Color Contrast

The extension uses VS Code theme variables to ensure:

- Text meets WCAG AA contrast requirements
- Focus indicators are clearly visible
- Color is not the sole indicator of state

### High Contrast Mode

Additional styling is provided for high contrast mode:
- Thicker outlines (3px instead of 2px)
- Enhanced borders on interactive elements

## Testing Accessibility

### Manual Testing

#### Keyboard Navigation Test

1. Open a project table view
2. Press `Tab` to focus on the table
3. Use arrow keys to navigate between cells
4. Press `Enter` on an interactive cell to open dropdown
5. Use arrow keys to navigate dropdown options
6. Press `Enter` to select an option
7. Verify focus returns to the table cell

#### Screen Reader Test

Using a screen reader (NVDA, JAWS, VoiceOver):

1. Navigate to the table
2. Verify table structure is announced
3. Navigate by row and column
4. Verify column headers are announced
5. Verify cell values are read correctly
6. Open a dropdown and verify options are announced

### Automated Testing

Run the keyboard navigation test suite:

```bash
npm test -- TableKeyboardNavigator.test.ts
```

The test suite covers:
- Cell navigation with arrow keys
- Edit mode entry and exit
- Focus management
- Boundary conditions
- Interactive vs. non-interactive cells

## Implementation Details

### Components

#### TableKeyboardNavigator

Manages keyboard navigation within the table:
- Handles arrow key navigation
- Tracks active cell position
- Manages edit mode state
- Provides callbacks for cell focus and edit events

#### FieldDropdown

Accessible dropdown component:
- Full keyboard support
- ARIA attributes for screen readers
- Proper focus management
- Returns focus to trigger element on close

### CSS

The `accessibility.css` file provides:
- Focus indicator styles
- High contrast mode support
- Screen reader only text utilities
- Keyboard help overlay styles (optional)

## Best Practices

### For Developers

When adding new interactive elements:

1. **Add ARIA attributes**
   - Use appropriate roles (`button`, `listbox`, `option`, etc.)
   - Add `aria-label` for descriptive text
   - Set `aria-disabled` or `aria-readonly` as needed

2. **Ensure keyboard support**
   - All interactive elements must be keyboard accessible
   - Implement standard keyboard shortcuts
   - Prevent keyboard traps

3. **Provide focus indicators**
   - Use visible outlines or borders
   - Ensure contrast meets WCAG requirements
   - Test in high contrast mode

4. **Test with real users**
   - Test with keyboard only
   - Test with screen readers
   - Get feedback from users with disabilities

### For Users

#### Keyboard Shortcuts Quick Reference

- **Navigate cells**: Arrow keys
- **Edit cell**: `Enter` or `F2`
- **Select option**: `Enter` or `Space` in dropdown
- **Cancel**: `Escape`
- **Move between elements**: `Tab` / `Shift + Tab`

#### Tips for Screen Reader Users

1. Use table navigation commands to move efficiently
2. Listen for "editable" or "read-only" announcements
3. Column headers identify the type of data in each column
4. Dropdowns announce the current selection and available options

## Future Enhancements

Potential improvements for future releases:

1. **Keyboard shortcuts overlay**
   - Press `?` to show keyboard shortcuts
   - Context-sensitive help

2. **Additional ARIA live regions**
   - Announce updates when cells change
   - Notify of loading states

3. **Custom keyboard shortcuts**
   - User-configurable shortcuts
   - Integration with VS Code keybindings

4. **Enhanced screen reader announcements**
   - More descriptive labels
   - Better context for complex cells

5. **Accessibility settings**
   - Toggle reduced motion
   - Adjust focus indicator style
   - Configure announcement verbosity

## Resources

- [ARIA Authoring Practices Guide - Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: Accessible Rich Internet Applications (ARIA)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [VS Code Accessibility Documentation](https://code.visualstudio.com/docs/editor/accessibility)

## Feedback

If you encounter accessibility issues or have suggestions:

1. Open an issue on GitHub
2. Include your screen reader and version (if applicable)
3. Describe the expected vs. actual behavior
4. Note your VS Code theme (light/dark/high contrast)

We are committed to making this extension accessible to all users.
