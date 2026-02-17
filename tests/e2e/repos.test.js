/**
 * E2E Tests for Repository Commands
 * Tests: repos list, repos info
 */

const { runCLI, apiCall, skipIfServerUnreachable, skipIfTokenInvalid } = require('./helpers');

describe('CLI Repository Commands', () => {
  let serverReachable = true;
  let hasValidToken = true;

  beforeAll(async () => {
    serverReachable = !(await skipIfServerUnreachable());
    hasValidToken = !skipIfTokenInvalid();
  });

  describe('repos list', () => {
    it('should list repositories', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('repos list');

      expect(exitCode).toBe(0);
      // Should either show repos or "No repositories" message
      expect(stdout).toMatch(/Repository|No repositories|ID|Name/i);
    });

    it('should support JSON output', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('repos list --json');

      expect(exitCode).toBe(0);
      // Should be valid JSON (array or object)
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it('should return repos via API', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const response = await apiCall('GET', '/api/repos');

      expect(response).toBeDefined();
      // Response should have configs/repositories array or be an array
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
    it('should show error for non-existent repo', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, stderr, exitCode } = runCLI('repos info non-existent-id-12345', {
        expectError: true,
      });

      // Should fail with error
      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
