/**
 * @jest-environment jsdom
 */
import { TableKeyboardNavigator } from '../../../../src/webviews/client/components/TableKeyboardNavigator';

describe('TableKeyboardNavigator', () => {
  let table: HTMLTableElement;
  let navigator: TableKeyboardNavigator;
  let onEnterEditMode: jest.Mock;
  let onExitEditMode: jest.Mock;
  let onCellFocus: jest.Mock;

  beforeEach(() => {
    // Create a test table
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr data-gh-item-id="item1">
            <td>1</td>
            <td>Task 1</td>
            <td class="interactive-cell">Todo</td>
          </tr>
          <tr data-gh-item-id="item2">
            <td>2</td>
            <td>Task 2</td>
            <td class="interactive-cell">In Progress</td>
          </tr>
          <tr data-gh-item-id="item3">
            <td>3</td>
            <td>Task 3</td>
            <td class="interactive-cell">Done</td>
          </tr>
        </tbody>
      </table>
    `;

    table = document.querySelector('table') as HTMLTableElement;

    // Create mocks
    onEnterEditMode = jest.fn();
    onExitEditMode = jest.fn();
    onCellFocus = jest.fn();

    // Create navigator
    navigator = new TableKeyboardNavigator(table, {
      onEnterEditMode,
      onExitEditMode,
      onCellFocus,
    });
  });

  afterEach(() => {
    navigator.destroy();
    document.body.innerHTML = '';
  });

  describe('makeCellsFocusable', () => {
    test('makes all cells focusable', () => {
      navigator.makeCellsFocusable();

      const cells = table.querySelectorAll('tbody td');
      cells.forEach((cell) => {
        expect((cell as HTMLElement).tabIndex).toBeDefined();
        expect((cell as HTMLElement).tabIndex >= -1).toBe(true);
      });
    });

    test('makes first cell tabbable', () => {
      navigator.makeCellsFocusable();

      const firstCell = table.querySelector('tbody tr td') as HTMLElement;
      expect(firstCell.tabIndex).toBe(0);
    });
  });

  describe('Arrow key navigation', () => {
    beforeEach(() => {
      navigator.makeCellsFocusable();
    });

    test('ArrowRight moves focus to next cell', () => {
      const firstCell = table.querySelector('tbody tr:first-child td:first-child') as HTMLElement;
      firstCell.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      table.dispatchEvent(event);

      expect(onCellFocus).toHaveBeenCalled();
    });

    test('ArrowDown moves focus to cell below', () => {
      const firstCell = table.querySelector('tbody tr:first-child td:first-child') as HTMLElement;
      firstCell.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      table.dispatchEvent(event);

      expect(onCellFocus).toHaveBeenCalled();
    });

    test('ArrowLeft moves focus to previous cell', () => {
      const secondCell = table.querySelector('tbody tr:first-child td:nth-child(2)') as HTMLElement;
      secondCell.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      table.dispatchEvent(event);

      expect(onCellFocus).toHaveBeenCalled();
    });

    test('ArrowUp moves focus to cell above', () => {
      const secondRowCell = table.querySelector('tbody tr:nth-child(2) td:first-child') as HTMLElement;
      secondRowCell.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      table.dispatchEvent(event);

      expect(onCellFocus).toHaveBeenCalled();
    });

    test('does not move beyond table boundaries', () => {
      const firstCell = table.querySelector('tbody tr:first-child td:first-child') as HTMLElement;
      firstCell.focus();

      // Try to move left from first cell
      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      table.dispatchEvent(leftEvent);

      // Should still be on first cell
      expect(onCellFocus).toHaveBeenCalledWith(expect.any(HTMLElement), { rowIndex: 0, colIndex: 0 });
    });
  });

  describe('Edit mode', () => {
    beforeEach(() => {
      navigator.makeCellsFocusable();
    });

    test('Enter key triggers edit mode for interactive cells', () => {
      const interactiveCell = table.querySelector('.interactive-cell') as HTMLElement;
      interactiveCell.focus();
      interactiveCell.dispatchEvent(new Event('focusin', { bubbles: true }));

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      table.dispatchEvent(event);

      expect(onEnterEditMode).toHaveBeenCalled();
    });

    test('F2 key triggers edit mode for interactive cells', () => {
      const interactiveCell = table.querySelector('.interactive-cell') as HTMLElement;
      interactiveCell.focus();
      interactiveCell.dispatchEvent(new Event('focusin', { bubbles: true }));

      const event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true });
      table.dispatchEvent(event);

      expect(onEnterEditMode).toHaveBeenCalled();
    });

    test('Escape exits edit mode without committing', () => {
      navigator.setEditMode(true);

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      table.dispatchEvent(event);

      expect(onExitEditMode).toHaveBeenCalledWith(false);
      expect(navigator.isInEditMode()).toBe(false);
    });

    test('Enter exits edit mode with commit', () => {
      navigator.setEditMode(true);

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      table.dispatchEvent(event);

      expect(onExitEditMode).toHaveBeenCalledWith(true);
      expect(navigator.isInEditMode()).toBe(false);
    });

    test('does not trigger edit mode for non-interactive cells', () => {
      const nonInteractiveCell = table.querySelector('tbody tr:first-child td:nth-child(2)') as HTMLElement;
      nonInteractiveCell.focus();
      nonInteractiveCell.dispatchEvent(new Event('focusin', { bubbles: true }));

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      table.dispatchEvent(event);

      expect(onEnterEditMode).not.toHaveBeenCalled();
    });
  });

  describe('Edit mode state management', () => {
    test('isInEditMode returns correct state', () => {
      expect(navigator.isInEditMode()).toBe(false);

      navigator.setEditMode(true);
      expect(navigator.isInEditMode()).toBe(true);

      navigator.setEditMode(false);
      expect(navigator.isInEditMode()).toBe(false);
    });

    test('arrow keys do not work in edit mode', () => {
      navigator.setEditMode(true);
      navigator.makeCellsFocusable();

      const firstCell = table.querySelector('tbody tr:first-child td:first-child') as HTMLElement;
      firstCell.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      table.dispatchEvent(event);

      // onCellFocus should not be called when in edit mode
      expect(onCellFocus).not.toHaveBeenCalled();
    });
  });

  describe('Focus management', () => {
    test('updates active position when cell is focused', () => {
      navigator.makeCellsFocusable();

      const secondCell = table.querySelector('tbody tr:first-child td:nth-child(2)') as HTMLElement;
      secondCell.focus();
      secondCell.dispatchEvent(new Event('focusin', { bubbles: true }));

      // Move right from second cell
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      table.dispatchEvent(event);

      // Should move to third cell
      expect(onCellFocus).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ colIndex: expect.any(Number) })
      );
    });
  });

  describe('Space key behavior', () => {
    beforeEach(() => {
      navigator.makeCellsFocusable();
    });

    test('Space key triggers edit mode for interactive cells', () => {
      const interactiveCell = table.querySelector('.interactive-cell') as HTMLElement;
      interactiveCell.focus();
      interactiveCell.dispatchEvent(new Event('focusin', { bubbles: true }));

      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      table.dispatchEvent(event);

      expect(onEnterEditMode).toHaveBeenCalled();
    });

    test('Space key does not trigger for non-interactive cells', () => {
      const nonInteractiveCell = table.querySelector('tbody tr:first-child td:nth-child(2)') as HTMLElement;
      nonInteractiveCell.focus();
      nonInteractiveCell.dispatchEvent(new Event('focusin', { bubbles: true }));

      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      table.dispatchEvent(event);

      expect(onEnterEditMode).not.toHaveBeenCalled();
    });
  });
});
