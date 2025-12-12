/**
 * @jest-environment jsdom
 */
import { EditorManager } from '../../../../src/webviews/client/editors/EditorManager';

// Mock renderCell
jest.mock('../../../../src/webviews/client/renderers/cellRenderer', () => ({
    renderCell: jest.fn().mockReturnValue('<span>Cell Content</span>')
}));

describe('EditorManager', () => {
    let container: HTMLElement;
    let table: HTMLTableElement;
    let row: HTMLTableRowElement;
    let cell: HTMLTableCellElement;
    let editorManager: EditorManager;

    // Mock window.__APP_MESSAGING__
    beforeAll(() => {
        (window as any).__APP_MESSAGING__ = {
            postMessage: jest.fn(),
            onMessage: jest.fn()
        };
    });

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);

        table = document.createElement('table');
        const tbody = document.createElement('tbody');
        row = document.createElement('tr');
        cell = document.createElement('td');
        cell.textContent = 'Original Value';

        row.appendChild(cell);
        tbody.appendChild(row);
        table.appendChild(tbody);
        container.appendChild(table);

        editorManager = new EditorManager('proj-123', 'view-key', []);
    });

    test('marks text cell as editable', () => {
        const fieldValue = { type: 'text', text: 'Test Value' };
        const field = { id: 'f1', name: 'Title', dataType: 'text' };
        const item = { id: 'i1', fieldValues: [fieldValue] };

        editorManager.makeEditable(cell, fieldValue, field, item);

        expect(cell.dataset.editable).toBe('true');
        expect(cell.dataset.fieldType).toBe('text');
        expect(cell.style.cursor).toBe('pointer');
    });

    test('marks number cell as editable', () => {
        const fieldValue = { type: 'number', number: 42 };
        const field = { id: 'f2', name: 'Points', dataType: 'number' };
        const item = { id: 'i1', fieldValues: [fieldValue] };

        editorManager.makeEditable(cell, fieldValue, field, item);

        expect(cell.dataset.editable).toBe('true');
        expect(cell.dataset.fieldType).toBe('number');
    });

    test('marks date cell as editable', () => {
        const fieldValue = { type: 'date', date: '2025-01-01T00:00:00Z' };
        const field = { id: 'f3', name: 'Due Date', dataType: 'date' };
        const item = { id: 'i1', fieldValues: [fieldValue] };

        editorManager.makeEditable(cell, fieldValue, field, item);

        expect(cell.dataset.editable).toBe('true');
        expect(cell.dataset.fieldType).toBe('date');
    });

    test('does not mark non-editable field types', () => {
        const fieldValue = { type: 'single_select', option: { name: 'Todo' } };
        const field = { id: 'f4', name: 'Status', dataType: 'single_select' };
        const item = { id: 'i1', fieldValues: [fieldValue] };

        editorManager.makeEditable(cell, fieldValue, field, item);

        expect(cell.dataset.editable).toBeUndefined();
    });

    test('cell has tabindex for keyboard navigation', () => {
        const fieldValue = { type: 'text', text: 'Test' };
        const field = { id: 'f1', name: 'Title', dataType: 'text' };
        const item = { id: 'i1', fieldValues: [fieldValue] };

        editorManager.makeEditable(cell, fieldValue, field, item);

        expect(cell.getAttribute('tabindex')).toBe('0');
    });
});
