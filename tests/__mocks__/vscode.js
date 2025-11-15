module.exports = {
  workspace: {
    getConfiguration: () => ({
      get: (k, def) => {
        if (k === 'useHttpApi') return true;
        if (k === 'queryTimeoutMs') return 30000;
        return def;
      },
    }),
  },
  window: {
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
  commands: {
    executeCommand: jest.fn(),
  },
  authentication: {
    getSession: jest.fn().mockImplementation(async (provider, scopes, opts) => {
      // Default mock: return undefined (no session). Tests can override this.
      return undefined;
    }),
  },
};
