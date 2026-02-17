/**
 * E2E Tests for Repository Commands
 * Tests: repos list, repos info
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Repository Commands', () => {
  describe('repos list', () => {
    itAuthenticated('should list repositories', async () => {
      const { stdout, exitCode } = runCLI('repos list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Repository|No repositories|ID|Name/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('repos list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should return repos via API', async () => {
      const response = await apiCall('GET', '/api/repos');

      expect(response).toBeDefined();
      const repos = response.configs || response.repositories || response;
      expect(Array.isArray(repos) || typeof repos === 'object').toBe(true);
    });
  });

  describe('repos help', () => {
    it('should display repos help', () => {
      const { stdout, exitCode } = runCLI('repos --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('add');
      expect(stdout).toContain('remove');
    });
  });

  describe('repos info', () => {
    itAuthenticated('should show error for non-existent repo', async () => {
      const { stdout, stderr, exitCode } = runCLI('repos info non-existent-id-12345', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
