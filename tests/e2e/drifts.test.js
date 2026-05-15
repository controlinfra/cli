/**
 * E2E Tests for Drift Commands — `drifts list`, `drifts stats`, help, error paths.
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');
const {
  expectListOutput, expectHelpLists, expectJsonOutput, expectHelpHasFlags,
  expectNotFoundError, expectNoBugMarkers,
} = require('./assertions');

describe('CLI Drift Commands', () => {
  describe('drifts list', () => {
    itAuthenticated('shows the drift table or the explicit empty-state copy', async () => {
      const result = runCLI('drifts list');
      expectListOutput(result, {
        tableHeader: 'Severity',
        emptyMarker: 'No drifts',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array', async () => {
      const result = runCLI('drifts list --json');
      const parsed = expectJsonOutput(result);
      const drifts = parsed.drifts || parsed;
      expect(Array.isArray(drifts)).toBe(true);
    });

    itAuthenticated('--severity filter exits cleanly', async () => {
      const { exitCode } = runCLI('drifts list --severity critical');
      expect(exitCode).toBe(0);
    });

    itAuthenticated('API endpoint returns the drifts envelope or a structured 4xx', async () => {
      const response = await apiCall('GET', '/api/drifts?limit=10');
      if (response && response.error) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      } else {
        const drifts = response.drifts || response;
        expect(Array.isArray(drifts) || typeof drifts === 'object').toBe(true);
      }
    });
  });

  describe('drifts stats', () => {
    itAuthenticated('renders the stats box with severity tallies', async () => {
      const result = runCLI('drifts stats');
      expect(result.exitCode).toBe(0);
      // The drifts-stats box has explicit labels — assert the actual
      // structure, not bag-of-words. (Old test passed if output contained
      // "drift" OR "total" OR "high" — any of which appears in a crash log.)
      expect(result.stdout).toContain('Drift Statistics');
      expect(result.stdout).toMatch(/Total Drifts:\s*\d+/);
      expect(result.stdout).toMatch(/Critical:\s*\d+/);
      expect(result.stdout).toMatch(/High:\s*\d+/);
      expect(result.stdout).toMatch(/Medium:\s*\d+/);
      expect(result.stdout).toMatch(/Low:\s*\d+/);
      expectNoBugMarkers(result);
    });
  });

  describe('drifts help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('drifts --help');
      expectHelpLists(result, [
        'list', 'show', 'fix', 'pr', 'ignore', 'resolve', 'stats', 'reanalyze', 'export',
      ]);
    });

    it('drifts export --help exposes the documented flags', () => {
      const result = runCLI('drifts export --help');
      expectHelpHasFlags(result, ['--repo', '--status', '--output']);
    });
  });

  describe('drifts show — error path', () => {
    itAuthenticated('non-existent drift returns specific "not found" copy', async () => {
      const result = runCLI('drifts show 0000000000000000aaaaaaaa', { expectError: true });
      expectNotFoundError(result, /Drift not found|No drift found/);
      expectNoBugMarkers(result);
    });
  });
});
