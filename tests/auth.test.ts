jest.mock('vscode');

jest.mock('../src/lib/ghHttp', () => ({
  ghHttpGraphQL: jest.fn(),
}));

import { ghQueryWithErrors } from '../src/lib/ghApiHelper';
import { ghHttpGraphQL } from '../src/lib/ghHttp';
import * as vscode from 'vscode';

describe('authentication flows', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('uses session token when present', async () => {
    (vscode.authentication.getSession as jest.Mock).mockResolvedValue({ accessToken: 'session-token' });
    (ghHttpGraphQL as jest.Mock).mockResolvedValue({ data: { ok: true } });

    const res = await ghQueryWithErrors('{ viewer { login } }');
    expect(res).toEqual({ data: { ok: true } });
    expect(ghHttpGraphQL).toHaveBeenCalled();
    const calledWith = (ghHttpGraphQL as jest.Mock).mock.calls[0];
    // args: query, variables, options
    expect(calledWith[2]).toBeDefined();
    expect(calledWith[2].token).toBe('session-token');
  });

  test('prompts to sign in when no session and triggers sign-in command', async () => {
    (vscode.authentication.getSession as jest.Mock).mockResolvedValue(undefined);
    (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Sign in to GitHub');
    (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

    try {
      await ghQueryWithErrors('{ viewer { login } }');
      // should not reach here
      throw new Error('Expected ghQueryWithErrors to throw ENOTAUTH');
    } catch (e: any) {
      expect(e).toBeDefined();
      expect(e.code).toBe('ENOTAUTH');
    }

    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('ghProjects.signIn');
  });
});
