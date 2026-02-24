/**
 * E2E Tests for Drift Commands
 * Tests: drifts list, drifts stats
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Drift Commands', () => {
  describe('drifts list', () => {
    itAuthenticated('should list drifts', async () => {
      const { stdout, exitCode } = runCLI('drifts list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Drift|No drifts|ID|Severity|Resource/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('drifts list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should support severity filter', async () => {
      const { stdout, exitCode } = runCLI('drifts list --severity critical');

      expect(exitCode).toBe(0);
      expect(stdout).toBeDefined();
    });

    itAuthenticated('should return drifts via API', async () => {
      const response = await apiCall('GET', '/api/drifts?limit=10');

      expect(response).toBeDefined();
      const drifts = response.drifts || response;
      expect(Array.isArray(drifts) || typeof drifts === 'object').toBe(true);
    });
  });

  describe('drifts stats', () => {
    itAuthenticated('should show drift statistics', async () => {
      const { stdout, exitCode } = runCLI('drifts stats');

      expect(exitCode).toBe(0);
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

    it('should display reanalyze subcommand in help', () => {
      const { stdout, exitCode } = runCLI('drifts --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('reanalyze');
    });

    it('should display export subcommand in help', () => {
      const { stdout, exitCode } = runCLI('drifts --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('export');
    });
  });

  describe('drifts export help', () => {
    it('should display export help with options', () => {
      const { stdout, exitCode } = runCLI('drifts export --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('--repo');
      expect(stdout).toContain('--status');
      expect(stdout).toContain('--output');
    });
  });

  describe('drifts show', () => {
    itAuthenticated('should show error for non-existent drift', async () => {
      const { stdout, stderr, exitCode } = runCLI('drifts show non-existent-drift-id', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
