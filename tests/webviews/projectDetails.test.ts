import { buildHtml } from '../../src/webviews/htmlBuilder';
import * as vscode from 'vscode';
import { ProjectEntry } from '../../src/lib/types';

jest.mock('vscode', () => ({
    Uri: {
        joinPath: jest.fn(),
        file: jest.fn(),
        parse: jest.fn(),
    },
    Webview: jest.fn(),
}), { virtual: true });

jest.mock('../../src/lib/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

describe('projectDetails buildHtml', () => {
    let mockWebview: any;
    let mockProject: ProjectEntry;

    beforeEach(() => {
        mockWebview = {
            cspSource: 'mock-csp',
            asWebviewUri: jest.fn((uri) => uri),
        };
        mockProject = {
            id: 'p1',
            title: 'Test Project',
            views: [
                { id: 'v1', name: 'Table View', layout: 'TABLE_LAYOUT' },
                { id: 'v2', name: 'Board View', layout: 'BOARD_LAYOUT' }
            ]
        };
    });

    test('generates HTML with correct fetcher scripts', () => {
        const fetcherUris = {
            overviewUri: { toString: () => 'overview.js' } as any,
            tableUri: { toString: () => 'table.js' } as any,
            boardUri: { toString: () => 'board.js' } as any,
            roadmapUri: { toString: () => 'roadmap.js' } as any,
            contentUri: { toString: () => 'content.js' } as any,
        };

        const html = buildHtml(
            mockWebview,
            mockProject,
            'elements.js',
            fetcherUris,
            'panel-key'
        );

        expect(html).toContain('<script nonce="');
        expect(html).toContain('src="overview.js"');
        expect(html).toContain('src="table.js"');
        expect(html).toContain('src="board.js"');
        expect(html).toContain('src="roadmap.js"');
        expect(html).toContain('src="content.js"');
        expect(html).toContain('window.__project_data__ =');
    });
});
