/**
 * @jest-environment jsdom
 */
import { ColumnHeaderMenu } from '../../../../src/webviews/client/components/ColumnHeaderMenu';

describe('ColumnHeaderMenu', () => {
    let mockField: any;
    let container: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = '';
        mockField = { id: 'field1', name: 'Status', dataType: 'SINGLE_SELECT' };

        // Create a container to anchor menu
        container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '100px';
        container.style.left = '100px';
        container.style.width = '150px';
        container.style.height = '30px';
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('creates menu with all options when all capabilities enabled', () => {
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: true,
            canSlice: true,
            canFilter: true,
            onSort: jest.fn(),
            onGroup: jest.fn(),
            onSlice: jest.fn(),
            onHide: jest.fn(),
            onMove: jest.fn(),
            onFilter: jest.fn()
        });

        menu.show(container);

        const menuElement = document.querySelector('.column-header-menu');
        expect(menuElement).toBeTruthy();

        const items = menuElement?.querySelectorAll('.menu-item');
        expect(items).toBeTruthy();

        // Should have: Header, Sort asc, Sort desc, Group, Slice, Filter, Hide, Move left, Move right
        const textContents = Array.from(items || []).map(item => item.textContent);
        expect(textContents).toContain('Sort ascending ↑');
        expect(textContents).toContain('Sort descending ↓');
        expect(textContents).toContain('Group by values');
        expect(textContents).toContain('Slice by values');
        expect(textContents).toContain('Filter by values...');
        expect(textContents).toContain('Hide field');
        expect(textContents).toContain('Move left ←');
        expect(textContents).toContain('Move right →');
    });

    test('hides group option when canGroup is false', () => {
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: true,
            canFilter: false,
            onSort: jest.fn()
        });

        menu.show(container);

        const items = document.querySelectorAll('.menu-item');
        const textContents = Array.from(items).map(item => item.textContent);

        expect(textContents).not.toContain('Group by values');
        expect(textContents).toContain('Slice by values');
    });

    test('hides slice option when canSlice is false', () => {
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: true,
            canSlice: false,
            canFilter: false,
            onSort: jest.fn()
        });

        menu.show(container);

        const items = document.querySelectorAll('.menu-item');
        const textContents = Array.from(items).map(item => item.textContent);

        expect(textContents).toContain('Group by values');
        expect(textContents).not.toContain('Slice by values');
    });

    test('calls onSort with ASC when Sort ascending is clicked', () => {
        const onSort = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false,
            onSort
        });

        menu.show(container);

        const sortAscItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Sort ascending ↑');

        expect(sortAscItem).toBeTruthy();
        (sortAscItem as HTMLElement).click();

        expect(onSort).toHaveBeenCalledWith('ASC');
    });

    test('calls onSort with DESC when Sort descending is clicked', () => {
        const onSort = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false,
            onSort
        });

        menu.show(container);

        const sortDescItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Sort descending ↓');

        expect(sortDescItem).toBeTruthy();
        (sortDescItem as HTMLElement).click();

        expect(onSort).toHaveBeenCalledWith('DESC');
    });

    test('calls onGroup when Group by values is clicked', () => {
        const onGroup = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: true,
            canSlice: false,
            canFilter: false,
            onGroup
        });

        menu.show(container);

        const groupItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Group by values');

        expect(groupItem).toBeTruthy();
        (groupItem as HTMLElement).click();

        expect(onGroup).toHaveBeenCalled();
    });

    test('calls onSlice when Slice by values is clicked', () => {
        const onSlice = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: true,
            canFilter: false,
            onSlice
        });

        menu.show(container);

        const sliceItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Slice by values');

        expect(sliceItem).toBeTruthy();
        (sliceItem as HTMLElement).click();

        expect(onSlice).toHaveBeenCalled();
    });

    test('calls onHide when Hide field is clicked', () => {
        const onHide = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false,
            onHide
        });

        menu.show(container);

        const hideItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Hide field');

        expect(hideItem).toBeTruthy();
        (hideItem as HTMLElement).click();

        expect(onHide).toHaveBeenCalled();
    });

    test('calls onMove with left when Move left is clicked', () => {
        const onMove = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false,
            onMove
        });

        menu.show(container);

        const moveLeftItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Move left ←');

        expect(moveLeftItem).toBeTruthy();
        (moveLeftItem as HTMLElement).click();

        expect(onMove).toHaveBeenCalledWith('left');
    });

    test('calls onMove with right when Move right is clicked', () => {
        const onMove = jest.fn();
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false,
            onMove
        });

        menu.show(container);

        const moveRightItem = Array.from(document.querySelectorAll('.menu-item'))
            .find(item => item.textContent === 'Move right →');

        expect(moveRightItem).toBeTruthy();
        (moveRightItem as HTMLElement).click();

        expect(onMove).toHaveBeenCalledWith('right');
    });

    test('hides menu when backdrop is clicked', () => {
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false
        });

        menu.show(container);

        let menuElement = document.querySelector('.column-header-menu');
        expect(menuElement).toBeTruthy();

        const backdrop = document.body.querySelector('div[style*="position: fixed"]');
        expect(backdrop).toBeTruthy();
        (backdrop as HTMLElement).click();

        menuElement = document.querySelector('.column-header-menu');
        expect(menuElement).toBeFalsy();
    });

    test('hides menu when hide() is called', () => {
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false
        });

        menu.show(container);

        let menuElement = document.querySelector('.column-header-menu');
        expect(menuElement).toBeTruthy();

        menu.hide();

        menuElement = document.querySelector('.column-header-menu');
        expect(menuElement).toBeFalsy();
    });

    test('positions menu below anchor element', () => {
        const menu = new ColumnHeaderMenu(mockField, {
            canGroup: false,
            canSlice: false,
            canFilter: false
        });

        menu.show(container);

        const menuElement = document.querySelector('.column-header-menu') as HTMLElement;
        expect(menuElement).toBeTruthy();

        const menuTop = parseInt(menuElement.style.top);
        const containerRect = container.getBoundingClientRect();

        // Menu should be positioned below container (with 4px gap)
        expect(menuTop).toBeGreaterThan(containerRect.bottom);
    });
});
