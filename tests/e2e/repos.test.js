/**
 * E2E Tests for Repository Commands — `repos list`, `repos info`, help.
 *
 * Assertion strategy: see ./assertions.js. All tautological-regex matches
 * (the kind that let audit bugs slip past) have been replaced with
 * structure-specific assertions.
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');
const {
  expectListOutput, expectHelpLists, expectJsonOutput,
  expectNotFoundError, expectNoBugMarkers,
} = require('./assertions');

describe('CLI Repository Commands', () => {
  describe('repos list', () => {
    itAuthenticated('shows the repo table or the explicit empty-state copy', async () => {
      const result = runCLI('repos list');
      expectListOutput(result, {
        tableHeader: 'Repository',
        emptyMarker: 'No repositories configured',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array of objects', async () => {
      const result = runCLI('repos list --json');
      const parsed = expectJsonOutput(result);
      const repos = parsed.repositories || parsed.configs || parsed;
      expect(Array.isArray(repos)).toBe(true);
    });

    itAuthenticated('API path returns either configs or repositories key', async () => {
      const response = await apiCall('GET', '/api/repo-configs');
      const repos = response.repositories || response.configs;
      expect(Array.isArray(repos)).toBe(true);
    });
  });

  describe('repos help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('repos --help');
      expectHelpLists(result, ['list', 'add', 'update', 'remove', 'info', 'stats']);
    });
  });

  describe('repos info — error path', () => {
    itAuthenticated('non-existent ID returns specific "not found" copy + non-zero exit', async () => {
      const result = runCLI('repos info non-existent-id-12345', { expectError: true });
      // The controller emits "Repository configuration not found" (server)
      // or "No repository found matching ..." (CLI resolver). Either is a
      // valid not-found marker; opaque "error" output is not.
      expectNotFoundError(
        result,
        /Repository (configuration )?not found|No repository found matching/,
      );
      expectNoBugMarkers(result);
    });
  });
});