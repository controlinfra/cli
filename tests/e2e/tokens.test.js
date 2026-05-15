/**
 * E2E Tests for Token Commands — `tokens list`, help.
 *
 * Note: CLI tokens (ci_ prefix) may lack `tokens:read` scope, so tests
 * accept either success OR a specific permission error — never an
 * opaque crash.
 */

const { runCLI, itAuthenticated } = require('./helpers');
const {
  expectHelpLists, expectJsonOutput, expectSuccessOrPermissionError, expectNoBugMarkers,
} = require('./assertions');

describe('CLI Token Commands', () => {
  describe('tokens list', () => {
    itAuthenticated('renders the token table or returns a specific permission error', async () => {
      const result = runCLI('tokens list', { expectError: true });
      expectSuccessOrPermissionError(result, () => {
        // Success path: header row contains "Name" and "Scopes" columns.
        // (The empty state is "No tokens" — exit 0 either way.)
        expect(result.stdout).toMatch(/Name\s+Scopes|No tokens|No CLI tokens/);
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits an array when permitted', async () => {
      const result = runCLI('tokens list --json', { expectError: true });
      expectSuccessOrPermissionError(result, () => {
        const parsed = expectJsonOutput(result);
        const tokens = parsed.tokens || parsed;
        expect(Array.isArray(tokens)).toBe(true);
      });
    });
  });

  describe('tokens help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('tokens --help');
      expectHelpLists(result, ['list', 'create', 'revoke']);
    });
  });
});
