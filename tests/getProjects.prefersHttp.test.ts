import getProjectsForReposArray from '../src/treeView/getProjects';

jest.mock('../src/lib/ghApiHelper', () => ({
  ghQueryWithErrors: jest.fn(),
}));
jest.mock('../src/lib/ghRunner', () => ({
  ghGraphQLQuery: jest.fn(),
}));

const vscode = require('vscode');
const ghApi = require('../src/lib/ghApiHelper');
const ghRunner = require('../src/lib/ghRunner');

describe('getProjects preferHttp behavior', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('when preferHttp=true and ghQueryWithErrors throws ENOTAUTH, do not fallback to CLI', async () => {
    // force preferHttp true
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({ get: (k: string, def: any) => {
      if (k === 'preferHttp') return true;
      return def;
    }} as any);

    (ghApi.ghQueryWithErrors as jest.Mock).mockImplementation(async () => {
      const e: any = new Error('Not authenticated');
      e.code = 'ENOTAUTH';
      throw e;
    });

    const arr = [ { remotes: [ { url: 'git@github.com:owner/repo.git' } ] } ];
    const res = await getProjectsForReposArray(arr as any);

    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(1);
    expect(res[0].owner).toBe('owner');
    expect(res[0].name).toBe('repo');
    expect(res[0].error).toBeDefined();
    expect(ghRunner.ghGraphQLQuery).not.toHaveBeenCalled();
  });

  test('when preferHttp=false and auth missing, fallback to CLI', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({ get: (k: string, def: any) => {
      if (k === 'preferHttp') return false;
      return def;
    }} as any);

    (ghApi.ghQueryWithErrors as jest.Mock).mockImplementation(async () => {
      const e: any = new Error('Not authenticated');
      e.code = 'ENOTAUTH';
      throw e;
    });

    (ghRunner.ghGraphQLQuery as jest.Mock).mockImplementation(async (q,v) => {
      return { data: { repository: { projectsV2: { nodes: [ { id: 'p1', title: 'P1' } ] } } } };
    });

    const arr = [ { remotes: [ { url: 'git@github.com:owner/repo.git' } ] } ];
    const res = await getProjectsForReposArray(arr as any);

    expect(res.length).toBe(1);
    expect(res[0].projects && res[0].projects.length).toBeGreaterThan(0);
    expect(ghRunner.ghGraphQLQuery).toHaveBeenCalled();
  });
});
