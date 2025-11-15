jest.mock('vscode');

jest.mock('../src/lib/ghHttp', () => ({
  ghHttpGraphQL: jest.fn(),
}));

import { ghQueryWithErrors } from '../src/lib/ghApiHelper';
import { ghHttpGraphQL } from '../src/lib/ghHttp';
import * as vscode from 'vscode';

describe('ghApiHelper auth-only', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('throws when ghHttpGraphQL fails even with session', async () => {
    // simulate session present
    (vscode.authentication.getSession as jest.Mock).mockResolvedValue({ accessToken: 'tok' });
    (ghHttpGraphQL as jest.Mock).mockImplementation(() => {
      throw new Error('HTTP API unexpected error');
    });

    await expect(ghQueryWithErrors('{ test }')).rejects.toThrow('HTTP API unexpected error');
    expect(ghHttpGraphQL).toHaveBeenCalled();
  });
});
