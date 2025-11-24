/**
 * @jest-environment jsdom
 */
import { ProjectTable } from '../../../../src/webviews/client/components/ProjectTable';
import { renderCell } from '../../../../src/webviews/client/renderers/cellRenderer';

// Mock renderCell
jest.mock('../../../../src/webviews/client/renderers/cellRenderer', () => ({
    renderCell: jest.fn().mockReturnValue('<span>Cell Content</span>')
}));

describe('ProjectTable', () => {
    let container: HTMLElement;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    test('renders table with headers and rows', () => {
        const fields = [
            { id: 'f1', name: 'Title' },
            { id: 'f2', name: 'Status' }
        ];
        const items = [
            {
                id: 'i1',
                fieldValues: [
                    { fieldId: 'f1', type: 'text', text: 'Item 1' },
                    { fieldId: 'f2', type: 'single_select', option: { name: 'Todo' } }
                ]
            }
        ];

        const table = new ProjectTable(container, fields, items);
        table.render();

        // Check if table exists
        const tableEl = container.querySelector('table');
        expect(tableEl).toBeTruthy();

        // Check Headers
        const headers = container.querySelectorAll('th');
        expect(headers.length).toBe(3); // #, Title, Status
        expect(headers[1].textContent).toBe('Title');
        expect(headers[2].textContent).toBe('Status');

        // Check Rows
        const rows = container.querySelectorAll('tbody tr');
        expect(rows.length).toBe(1);
        expect(rows[0].getAttribute('data-gh-item-id')).toBe('i1');

        // Check Cells
        const cells = container.querySelectorAll('tbody td');
        expect(cells.length).toBe(3); // Index, Title, Status
        expect(cells[0].textContent).toBe('1');
        expect(cells[1].innerHTML).toBe('<span>Cell Content</span>');
    });

    test('renders grouped rows', () => {
        const fields = [
            { id: 'f1', name: 'Title' },
            { id: 'f2', name: 'Status', dataType: 'SINGLE_SELECT', options: [{ id: 'opt1', name: 'Todo', color: 'RED' }] }
        ];
        const items = [
            {
                id: 'i1',
                fieldValues: [
                    { fieldId: 'f1', type: 'text', text: 'Item 1' },
                    { fieldId: 'f2', type: 'single_select', option: { id: 'opt1', name: 'Todo' } }
                ]
            }
        ];

        const table = new ProjectTable(container, fields, items, { groupingFieldName: 'Status' });
        table.render();

        // Check Group Header
        const groupHeader = container.querySelector('tbody tr td div');
        expect(groupHeader).toBeTruthy();
        expect(groupHeader?.textContent).toContain('Todo');

        // Check Item Row
        const itemRow = container.querySelector('tr[data-gh-item-id="i1"]');
        expect(itemRow).toBeTruthy();
        expect(itemRow?.classList.contains('group-row-opt1')).toBe(true);
    });

    test('renders grouped rows for iterations', () => {
        const fields = [
            { id: 'f1', name: 'Title', dataType: 'TEXT' },
            {
                id: 'f2',
                name: 'Iteration',
                dataType: 'ITERATION',
                configuration: {
                    iterations: [{ id: 'it1', title: 'Sprint 1', startDate: '2023-01-01' }]
                }
            }
        ];
        const items = [
            {
                id: 'i1',
                fieldValues: [
                    { fieldId: 'f1', type: 'text', text: 'Item 1' },
                    { fieldId: 'f2', type: 'iteration', iterationId: 'it1', title: 'Sprint 1' }
                ]
            }
        ];

        const table = new ProjectTable(container, fields, items, { groupingFieldName: 'Iteration' });
        table.render();

        // Check Group Header
        const groupHeader = container.querySelector('tbody tr td div');
        expect(groupHeader).toBeTruthy();
        expect(groupHeader?.textContent).toContain('Sprint 1');

        // Check Item Row
        const itemRow = container.querySelector('tr[data-gh-item-id="i1"]');
        expect(itemRow).toBeTruthy();
        expect(itemRow?.classList.contains('group-row-it1')).toBe(true);
    });
});
