/**
 * E2E Tests for Drift Commands
 * Tests: drifts list, drifts stats
 */

const { runCLI, apiCall, skipIfServerUnreachable, skipIfTokenInvalid } = require('./helpers');

describe('CLI Drift Commands', () => {
  let serverReachable = true;
  let hasValidToken = true;

  beforeAll(async () => {
    serverReachable = !(await skipIfServerUnreachable());
    hasValidToken = !skipIfTokenInvalid();
  });

  describe('drifts list', () => {
    it('should list drifts', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('drifts list');

      expect(exitCode).toBe(0);
      // Should either show drifts or "No drifts" message
      expect(stdout).toMatch(/Drift|No drifts|ID|Severity|Resource/i);
    });

    it('should support JSON output', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('drifts list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it('should support severity filter', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('drifts list --severity critical');

      expect(exitCode).toBe(0);
      expect(stdout).toBeDefined();
    });

    it('should return drifts via API', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const response = await apiCall('GET', '/api/drifts?limit=10');

      expect(response).toBeDefined();
      const drifts = response.drifts || response;
      expect(Array.isArray(drifts) || typeof drifts === 'object').toBe(true);
    });
  });

  describe('drifts stats', () => {
    it('should show drift statistics', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('drifts stats');

      expect(exitCode).toBe(0);
      // Should show some stats or message
      expect(stdout).toMatch(/drift|stat|total|critical|high|medium|low/i);
    });
  });

  describe('drifts help', () => {
    it('should display drifts help', () => {
      const { stdout, exitCode } = runCLI('drifts --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('show');
      expect(stdout).toContain('fix');
    });
  });

  describe('drifts show', () => {
    it('should show error for non-existent drift', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, stderr, exitCode } = runCLI('drifts show non-existent-drift-id', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
