jest.mock('../src/lib/ghHttp', () => ({
  ghHttpGraphQL: jest.fn(),
}));

const vscode = require('vscode');
const ghApi = require('../src/lib/ghApiHelper');
const ghHttp = require('../src/lib/ghHttp');

describe('ghQueryWithErrors error normalization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('throws ENOTAUTH when no VS Code auth session', async () => {
    // Default mock in __mocks__/vscode returns undefined session
    await expect(ghApi.ghQueryWithErrors('query {}')).rejects.toHaveProperty(
      'code',
      'ENOTAUTH',
    );
  });

  test('maps ETIMEDOUT from HTTP GraphQL errors', async () => {
    // Mock a session present
    jest.spyOn(vscode.authentication, 'getSession').mockImplementation(async () => ({ accessToken: 'tok' }));
    // Simulate ghHttpGraphQL throwing a timeout error
    const e: any = new Error('request timed out');
    e.code = 'ETIMEDOUT';
    (ghHttp.ghHttpGraphQL as jest.Mock).mockImplementation(async () => { throw e; });

    await expect(ghApi.ghQueryWithErrors('query {}')).rejects.toHaveProperty(
      'code',
      'ETIMEDOUT',
    );
  });

  test('maps EPERM for permission/unauthorized HTTP errors', async () => {
    jest.spyOn(vscode.authentication, 'getSession').mockImplementation(async () => ({ accessToken: 'tok' }));
    const e: any = new Error('403 Forbidden: permission denied');
    e.status = 403;
    (ghHttp.ghHttpGraphQL as jest.Mock).mockImplementation(async () => { throw e; });

    await expect(ghApi.ghQueryWithErrors('query {}')).rejects.toHaveProperty(
      'code',
      'EPERM',
    );
  });
});
