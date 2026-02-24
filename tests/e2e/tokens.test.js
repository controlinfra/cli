/**
 * E2E Tests for Token Commands
 * Tests: tokens list
 */

const { runCLI, itAuthenticated } = require('./helpers');

describe('CLI Token Commands', () => {
  describe('tokens list', () => {
    itAuthenticated('should list tokens', async () => {
      const { stdout, exitCode } = runCLI('tokens list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Token|No tokens|ID|Name|Key/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('tokens list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
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
