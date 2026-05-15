/**
 * E2E Tests for Workspace Commands — `workspaces list`, `workspaces info`, help.
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');
const {
  expectListOutput, expectHelpLists, expectJsonOutput,
  expectNotFoundError, expectNoBugMarkers,
} = require('./assertions');

describe('CLI Workspace Commands', () => {
  describe('workspaces list', () => {
    itAuthenticated('shows the workspace table or the explicit empty-state copy', async () => {
      const result = runCLI('workspaces list');
      expectListOutput(result, {
        // Column headers include Name + Cloud; empty state is "No workspaces".
        tableHeader: 'Name',
        emptyMarker: 'No workspaces',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array', async () => {
      const result = runCLI('workspaces list --json');
      const parsed = expectJsonOutput(result);
      const workspaces = parsed.workspaces || parsed;
      expect(Array.isArray(workspaces)).toBe(true);
    });

    itAuthenticated('API endpoint returns the expected envelope', async () => {
      const response = await apiCall('GET', '/api/workspaces');
      const workspaces = response.workspaces || response;
      expect(Array.isArray(workspaces) || typeof workspaces === 'object').toBe(true);
    });
  });

  describe('workspaces help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('workspaces --help');
      expectHelpLists(result, [
        'list', 'add', 'info', 'update', 'remove', 'default',
        'access', 'access-add', 'access-remove', 'visibility',
      ]);
    });
  });

  describe('workspaces info — error path', () => {
    itAuthenticated('non-existent ID returns specific "not found" copy + non-zero exit', async () => {
      const result = runCLI('workspaces info non-existent-id-12345', { expectError: true });
      expectNotFoundError(
        result,
        /Workspace not found|No workspace found matching/,
      );
      expectNoBugMarkers(result);
    });
  });
});
