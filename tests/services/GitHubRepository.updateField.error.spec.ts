jest.mock('vscode');
import { GitHubRepository } from '../../src/services/GitHubRepository';

describe('GitHubRepository.updateProjectV2Field error mapping', () => {
  const originalQuery = (GitHubRepository as any).prototype.query;
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    (GitHubRepository as any).prototype.query = originalQuery;
    // Clear singleton so other tests unaffected
    (GitHubRepository as any).instance = undefined;
    jest.clearAllMocks();
  });

  it('returns actionable message and shows warning when GraphQL reports unresolvable node id', async () => {
    // Mock query to throw the GraphQL error
    const error = new Error("Request failed due to following response errors:\n - Could not resolve to a node with the global id of 'invalid-field-id-xyz'");
    (GitHubRepository as any).prototype.query = jest.fn().mockRejectedValue(error);

      // Mock telemetry helper so we can assert it was called
      jest.mock('../../src/services/telemetry', () => ({
        sendEvent: jest.fn(),
      }));
      const telemetry = require('../../src/services/telemetry');

    const repo = GitHubRepository.getInstance();
    const res = await repo.updateFieldValue('proj', 'item', 'invalid-field-id-xyz', 'x', 'text');

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid field id provided/);
      // Ensure actionable message returned
    
      expect(telemetry.sendEvent).toHaveBeenCalledWith('invalid_field_id_detected', expect.objectContaining({
        projectId: 'proj',
        itemId: 'item',
        fieldId: 'invalid-field-id-xyz',
      }));
  });
});
