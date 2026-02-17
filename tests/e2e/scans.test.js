/**
 * E2E Tests for Scan Commands
 * Tests: scan list, scan status
 */

const { runCLI, apiCall, skipIfServerUnreachable, skipIfTokenInvalid } = require('./helpers');

describe('CLI Scan Commands', () => {
  let serverReachable = true;
  let hasValidToken = true;

  beforeAll(async () => {
    serverReachable = !(await skipIfServerUnreachable());
    hasValidToken = !skipIfTokenInvalid();
  });

  describe('scan list', () => {
    it('should list scans', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('scan list');

      expect(exitCode).toBe(0);
      // Should either show scans or "No scans" message
      expect(stdout).toMatch(/Scan|No scans|ID|Status|completed|running|failed/i);
    });

    it('should support JSON output', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('scan list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it('should support limit option', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('scan list --limit 5');

      expect(exitCode).toBe(0);
      expect(stdout).toBeDefined();
    });

    it('should return scans via API', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const response = await apiCall('GET', '/api/scans?limit=10');

      expect(response).toBeDefined();
      const scans = response.scans || response;
      expect(Array.isArray(scans) || typeof scans === 'object').toBe(true);
    });
  });

  describe('scan help', () => {
    it('should display scan help', () => {
      const { stdout, exitCode } = runCLI('scan --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('run');
      expect(stdout).toContain('list');
      expect(stdout).toContain('status');
    });
  });

  describe('scan run help (drift gate options)', () => {
    it('should display --fail-on-drift option', () => {
      const { stdout, exitCode } = runCLI('scan run --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--fail-on-drift');
    });

    it('should display --fail-on-severity option', () => {
      const { stdout, exitCode } = runCLI('scan run --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--fail-on-severity');
    });

    it('should display --fail-on-new-only option', () => {
      const { stdout, exitCode } = runCLI('scan run --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--fail-on-new-only');
    });
  });

  describe('scan wait help (drift gate options)', () => {
    it('should display --fail-on-drift option', () => {
      const { stdout, exitCode } = runCLI('scan wait --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--fail-on-drift');
    });

    it('should display --fail-on-severity option', () => {
      const { stdout, exitCode } = runCLI('scan wait --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--fail-on-severity');
    });

    it('should display --fail-on-new-only option', () => {
      const { stdout, exitCode } = runCLI('scan wait --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--fail-on-new-only');
    });
  });

  describe('scan status', () => {
    it('should show error for non-existent scan', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, stderr, exitCode } = runCLI('scan status non-existent-scan-id', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
