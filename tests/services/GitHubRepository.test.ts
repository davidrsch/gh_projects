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

    describe('updateFieldValue', () => {
        test('updates text field successfully', async () => {
            graphqlMock.mockResolvedValue({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'i1' } } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', 'New text', 'text');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('updateProjectV2ItemFieldValue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        projectId: 'p1',
                        itemId: 'i1',
                        fieldId: 'f1',
                        value: { text: 'New text' }
                    })
                })
            );
        });

        test('updates number field successfully', async () => {
            graphqlMock.mockResolvedValue({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'i1' } } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', 42, 'number');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('updateProjectV2ItemFieldValue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        value: { number: 42 }
                    })
                })
            );
        });

        test('updates date field successfully', async () => {
            graphqlMock.mockResolvedValue({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'i1' } } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', '2025-01-15', 'date');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('updateProjectV2ItemFieldValue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        value: { date: '2025-01-15' }
                    })
                })
            );
        });

        test('updates single_select field successfully', async () => {
            graphqlMock.mockResolvedValue({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'i1' } } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', 'option123', 'single_select');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('updateProjectV2ItemFieldValue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        value: { singleSelectOptionId: 'option123' }
                    })
                })
            );
        });

        test('updates iteration field successfully', async () => {
            graphqlMock.mockResolvedValue({ updateProjectV2ItemFieldValue: { projectV2Item: { id: 'i1' } } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', 'iter456', 'iteration');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('updateProjectV2ItemFieldValue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        value: { iterationId: 'iter456' }
                    })
                })
            );
        });

        test('updates labels field successfully', async () => {
            graphqlMock.mockResolvedValue({ addLabelsToLabelable: { clientMutationId: '1' } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', { labelIds: ['l1', 'l2'] }, 'labels');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('addLabelsToLabelable'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        labelableId: 'i1',
                        labelIds: ['l1', 'l2']
                    })
                })
            );
        });

        test('updates assignees field successfully', async () => {
            graphqlMock.mockResolvedValue({ addAssigneesToAssignable: { clientMutationId: '1' } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', { assigneeIds: ['u1', 'u2'] }, 'assignees');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('addAssigneesToAssignable'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        assignableId: 'i1',
                        assigneeIds: ['u1', 'u2']
                    })
                })
            );
        });

        test('updates reviewers field successfully', async () => {
            graphqlMock.mockResolvedValue({ requestReviews: { clientMutationId: '1' } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'pr1', 'f1', { userIds: ['u1'], teamIds: ['t1'] }, 'reviewers');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('requestReviews'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        pullRequestId: 'pr1',
                        userIds: ['u1'],
                        teamIds: ['t1']
                    })
                })
            );
        });

        test('updates milestone field successfully', async () => {
            graphqlMock.mockResolvedValue({ updateIssue: { clientMutationId: '1' } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', 'ms123', 'milestone');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('updateIssue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        id: 'i1',
                        milestoneId: 'ms123'
                    })
                })
            );
        });

        test('clears field value when value is null', async () => {
            graphqlMock.mockResolvedValue({ clearProjectV2ItemFieldValue: { projectV2Item: { id: 'i1' } } });

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', null, 'text');

            expect(result.success).toBe(true);
            expect(graphqlMock).toHaveBeenCalledWith(
                expect.stringContaining('clearProjectV2ItemFieldValue'),
                expect.objectContaining({
                    input: expect.objectContaining({
                        projectId: 'p1',
                        itemId: 'i1',
                        fieldId: 'f1'
                    })
                })
            );
        });

        test('handles GraphQL errors gracefully', async () => {
            graphqlMock.mockRejectedValue(new Error('GraphQL Error: Field not found'));

            const repo = GitHubRepository.getInstance();
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', 'value', 'text');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Field not found');
        });

        test('returns error for unsupported field type with non-string/number value', async () => {
            const repo = GitHubRepository.getInstance();
            // Use an object value that won't match string or number fallback
            const result = await repo.updateFieldValue('p1', 'i1', 'f1', { unknown: 'data' }, 'unsupported_type');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported field type');
        });
    });
});
