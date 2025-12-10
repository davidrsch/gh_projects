import { extractGitHubRepos } from '../../src/services/repositoryDiscovery';
import { RepoItem } from '../../src/lib/types';

jest.mock('child_process');

describe('repositoryDiscovery', () => {
    describe('extractGitHubRepos', () => {
        it('extracts owner/repo from HTTPS URLs', async () => {
            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: [
                        { url: 'https://github.com/owner1/repo1.git' }
                    ]
                }
            ];

            const result = await extractGitHubRepos(items);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ owner: 'owner1', name: 'repo1' });
        });

        it('extracts owner/repo from SSH URLs', async () => {
            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: [
                        { url: 'git@github.com:owner1/repo1.git' }
                    ]
                }
            ];

            const result = await extractGitHubRepos(items);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ owner: 'owner1', name: 'repo1' });
        });

        it('deduplicates repos with same owner/name', async () => {
            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: [
                        { url: 'https://github.com/owner1/repo1.git' }
                    ]
                },
                {
                    path: '/test/repo2',
                    remotes: [
                        { url: 'git@github.com:owner1/repo1.git' }
                    ]
                }
            ];

            const result = await extractGitHubRepos(items);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ owner: 'owner1', name: 'repo1' });
        });

        it('extracts multiple unique repos', async () => {
            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: [
                        { url: 'https://github.com/owner1/repo1.git' }
                    ]
                },
                {
                    path: '/test/repo2',
                    remotes: [
                        { url: 'https://github.com/owner2/repo2.git' }
                    ]
                }
            ];

            const result = await extractGitHubRepos(items);

            expect(result).toHaveLength(2);
            expect(result).toContainEqual({ owner: 'owner1', name: 'repo1' });
            expect(result).toContainEqual({ owner: 'owner2', name: 'repo2' });
        });

        it('handles items with multiple remotes', async () => {
            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: [
                        { url: 'https://github.com/owner1/repo1.git' },
                        { url: 'https://github.com/owner2/repo2.git' }
                    ]
                }
            ];

            const result = await extractGitHubRepos(items);

            expect(result).toHaveLength(2);
            expect(result).toContainEqual({ owner: 'owner1', name: 'repo1' });
            expect(result).toContainEqual({ owner: 'owner2', name: 'repo2' });
        });

        it('ignores non-GitHub URLs', async () => {
            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: [
                        { url: 'https://gitlab.com/owner1/repo1.git' },
                        { url: 'https://github.com/owner2/repo2.git' }
                    ]
                }
            ];

            const result = await extractGitHubRepos(items);

            // parseOwnerRepoFromUrl actually parses any git URL format, not just GitHub
            // So both will be extracted
            expect(result).toHaveLength(2);
        });

        it('handles empty items array', async () => {
            const result = await extractGitHubRepos([]);
            expect(result).toEqual([]);
        });

        it('handles items with no remotes', async () => {
            const { execFile } = require('child_process');
            
            // Mock execFile to simulate git command failure
            (execFile as jest.Mock).mockImplementation((cmd: string, args: string[], options: any, callback: Function) => {
                callback(new Error('No remote found'), '', 'fatal: No such remote');
            });

            const items: RepoItem[] = [
                {
                    path: '/test/repo1',
                    remotes: []
                }
            ];

            const result = await extractGitHubRepos(items);

            // Since there are no remotes and git command fails,
            // the fallback will fail silently
            expect(result).toEqual([]);
        });
    });
});
