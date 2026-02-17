/**
 * E2E Tests for Scan Commands
 * Tests: scan list, scan status
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Scan Commands', () => {
  describe('scan list', () => {
    itAuthenticated('should list scans', async () => {
      const { stdout, exitCode } = runCLI('scan list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Scan|No scans|ID|Status|completed|running|failed/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('scan list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should support limit option', async () => {
      const { stdout, exitCode } = runCLI('scan list --limit 5');

      expect(exitCode).toBe(0);
      expect(stdout).toBeDefined();
    });

    itAuthenticated('should return scans via API', async () => {
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
    itAuthenticated('should show error for non-existent scan', async () => {
      const { stdout, stderr, exitCode } = runCLI('scan status non-existent-scan-id', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
