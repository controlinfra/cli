/**
 * E2E Tests for Token Commands
 * Tests: tokens list, tokens help
 *
 * Note: token list/create/revoke require Pro+ plan and JWT auth.
 * CI tokens (ci_ prefix) may lack permission — tests accept both
 * success and "access denied" as valid outcomes.
 */

const { runCLI, itAuthenticated } = require('./helpers');

describe('CLI Token Commands', () => {
  describe('tokens list', () => {
    itAuthenticated('should list tokens or deny if insufficient permissions', async () => {
      const { stdout, stderr, exitCode } = runCLI('tokens list', { expectError: true });

      // Either succeeds (JWT with Pro+ plan) or denied (CLI token / free plan)
      if (exitCode === 0) {
        expect(stdout).toMatch(/Token|No tokens|ID|Name|Key/i);
      } else {
        expect(stdout + stderr).toMatch(/Access denied|permission|Insufficient|403/i);
      }
    });

    itAuthenticated('should support JSON output when permitted', async () => {
      const { stdout, stderr, exitCode } = runCLI('tokens list --json', { expectError: true });

      if (exitCode === 0) {
        expect(() => JSON.parse(stdout)).not.toThrow();
      } else {
        expect(stdout + stderr).toMatch(/Access denied|permission|Insufficient|403/i);
      }
    });
  });

  describe('tokens help', () => {
    it('should display tokens help with all subcommands', () => {
      const { stdout, exitCode } = runCLI('tokens --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('create');
      expect(stdout).toContain('revoke');
    });
  });
});
