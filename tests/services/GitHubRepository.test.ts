import { GitHubRepository } from '../../src/services/GitHubRepository';
import { AuthenticationManager } from '../../src/services/AuthenticationManager';
import { graphql } from '@octokit/graphql';

jest.mock('../../src/services/AuthenticationManager');
jest.mock('@octokit/graphql');
jest.mock('vscode', () => ({
    window: {
        showErrorMessage: jest.fn(),
    },
    Disposable: class { dispose() { } }
}), { virtual: true });
jest.mock('../../src/lib/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

describe('GitHubRepository', () => {
    let authMock: any;
    let graphqlMock: any;

    beforeEach(() => {
        jest.resetAllMocks();
        authMock = {
            ensureAuthenticated: jest.fn().mockResolvedValue('mock-token'),
        };
        (AuthenticationManager.getInstance as jest.Mock).mockReturnValue(authMock);
        graphqlMock = graphql as unknown as jest.Mock;
    });

    test('fetchProjectViews returns views correctly when API returns data directly', async () => {
        // Simulate real behavior: graphql returns data directly, NOT wrapped in .data
        const mockResponse = {
            node: {
                views: {
                    nodes: [
                        { id: 'v1', name: 'View 1', number: 1 },
                        { id: 'v2', name: 'View 2', number: 2 }
                    ]
                }
            }
        };
        graphqlMock.mockResolvedValue(mockResponse);

        const repo = GitHubRepository.getInstance();
        const views = await repo.fetchProjectViews('p1');

        expect(views).toHaveLength(2);
        expect(views[0].name).toBe('View 1');
        expect(views[1].number).toBe(2);
        expect(graphqlMock).toHaveBeenCalled();
    });

    test('fetchProjectViews handles empty response gracefully', async () => {
        graphqlMock.mockResolvedValue({ node: { views: { nodes: [] } } });

        const repo = GitHubRepository.getInstance();
        const views = await repo.fetchProjectViews('p1');
        expect(views).toEqual([]);
    });
    test('fetchProjectFields returns snapshot correctly', async () => {
        // Mock responses for the sequence of queries in fetchProjectFields
        graphqlMock
            .mockResolvedValueOnce({ node: { id: 'p1', title: 'Project 1' } }) // metaQuery
            .mockResolvedValueOnce({ node: { fields: { nodes: [{ id: 'f1', name: 'Status', dataType: 'SINGLE_SELECT' }] } } }) // fieldsQuery
            .mockResolvedValueOnce({}) // configIntroQuery
            // fieldsDetailQuery skipped because config types not present
            .mockResolvedValueOnce({ __type: { possibleTypes: [] } }) // introspectItemFieldTypes
            .mockResolvedValueOnce({ node: { items: { nodes: [{ id: 'i1', content: { title: 'Item 1' }, f0: { name: 'Todo' } }] } } }) // itemsQuery
            .mockResolvedValueOnce({}); // repoOptionsMap

        const repo = GitHubRepository.getInstance();
        const snapshot = await repo.fetchProjectFields('p1');

        expect(snapshot.project.title).toBe('Project 1');
        expect(snapshot.fields).toHaveLength(1);
        expect(snapshot.items).toHaveLength(1);
        expect(snapshot.items[0].content.title).toBe('Item 1');
    });
});
