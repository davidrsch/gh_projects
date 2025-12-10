import { ProjectService } from '../../src/services/projectService';
import { GitHubRepository } from '../../src/services/GitHubRepository';
import findGitRepos from '../../src/treeView/findRepos';
import getRemotesForPath from '../../src/treeView/getRemotes';
import { parseOwnerRepoFromUrl, uniqueProjectsFromResults } from '../../src/lib/projectUtils';

jest.mock('../../src/treeView/findRepos');
jest.mock('../../src/treeView/getRemotes');
jest.mock('../../src/services/GitHubRepository');
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string, defaultValue?: any) => defaultValue)
        }))
    },
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

describe('ProjectService', () => {
    let service: ProjectService;
    let mockGitHubRepository: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockGitHubRepository = {
            getProjects: jest.fn(),
            fetchProjectViews: jest.fn(),
        };
        (GitHubRepository.getInstance as jest.Mock).mockReturnValue(mockGitHubRepository);
        
        service = new ProjectService();
    });

    describe('loadProjects', () => {
        it('returns empty array when no git repos found', async () => {
            (findGitRepos as jest.Mock).mockResolvedValue([]);
            
            const result = await service.loadProjects('/test/workspace');
            
            expect(result).toEqual([]);
            expect(findGitRepos).toHaveBeenCalledWith('/test/workspace', 4);
        });

        it('discovers repos, fetches remotes, and queries GitHub API', async () => {
            const mockRepos = [
                { name: 'repo1', path: '/test/workspace/repo1', gitType: 'folder' as const }
            ];
            const mockRemotes = [
                { name: 'origin', url: 'https://github.com/owner1/repo1.git', push: true }
            ];
            const mockProjects = {
                owner: 'owner1',
                name: 'repo1',
                projects: [
                    { id: 'p1', title: 'Project 1', url: 'https://github.com/users/owner1/projects/1' }
                ]
            };
            const mockViews = [
                { id: 'v1', name: 'View 1', number: 1 }
            ];

            (findGitRepos as jest.Mock).mockResolvedValue(mockRepos);
            (getRemotesForPath as jest.Mock).mockResolvedValue(mockRemotes);
            mockGitHubRepository.getProjects.mockResolvedValue(mockProjects);
            mockGitHubRepository.fetchProjectViews.mockResolvedValue(mockViews);

            const result = await service.loadProjects('/test/workspace');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('p1');
            expect(result[0].title).toBe('Project 1');
            expect(result[0].views).toEqual(mockViews);
            expect(mockGitHubRepository.getProjects).toHaveBeenCalledWith('owner1', 'repo1');
            expect(mockGitHubRepository.fetchProjectViews).toHaveBeenCalledWith('p1');
        });

        it('deduplicates projects from multiple repos', async () => {
            const mockRepos = [
                { name: 'repo1', path: '/test/workspace/repo1', gitType: 'folder' as const },
                { name: 'repo2', path: '/test/workspace/repo2', gitType: 'folder' as const }
            ];
            const mockRemotes1 = [
                { name: 'origin', url: 'https://github.com/owner1/repo1.git', push: true }
            ];
            const mockRemotes2 = [
                { name: 'origin', url: 'https://github.com/owner1/repo2.git', push: true }
            ];
            const sharedProject = { id: 'p1', title: 'Shared Project', url: 'https://github.com/users/owner1/projects/1' };
            const mockProjects1 = {
                owner: 'owner1',
                name: 'repo1',
                projects: [sharedProject]
            };
            const mockProjects2 = {
                owner: 'owner1',
                name: 'repo2',
                projects: [sharedProject]
            };

            (findGitRepos as jest.Mock).mockResolvedValue(mockRepos);
            (getRemotesForPath as jest.Mock)
                .mockResolvedValueOnce(mockRemotes1)
                .mockResolvedValueOnce(mockRemotes2);
            mockGitHubRepository.getProjects
                .mockResolvedValueOnce(mockProjects1)
                .mockResolvedValueOnce(mockProjects2);
            mockGitHubRepository.fetchProjectViews.mockResolvedValue([]);

            const result = await service.loadProjects('/test/workspace');

            // Should only have one project despite being in two repos
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('p1');
            expect(result[0].repos).toHaveLength(2);
        });

        it('handles errors gracefully and returns empty array', async () => {
            (findGitRepos as jest.Mock).mockRejectedValue(new Error('Permission denied'));

            await expect(service.loadProjects('/test/workspace')).rejects.toThrow('Permission denied');
        });

        it('continues with partial results if some repos fail', async () => {
            const mockRepos = [
                { name: 'repo1', path: '/test/workspace/repo1', gitType: 'folder' as const }
            ];
            const mockRemotes = [
                { name: 'origin', url: 'https://github.com/owner1/repo1.git', push: true }
            ];
            const mockProjects = {
                owner: 'owner1',
                name: 'repo1',
                error: 'Not found'
            };

            (findGitRepos as jest.Mock).mockResolvedValue(mockRepos);
            (getRemotesForPath as jest.Mock).mockResolvedValue(mockRemotes);
            mockGitHubRepository.getProjects.mockResolvedValue(mockProjects);

            const result = await service.loadProjects('/test/workspace');

            expect(result).toEqual([]);
        });
    });
});
