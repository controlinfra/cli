/**
 * E2E Tests for Runner Commands
 * Tests: runners list
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Runner Commands', () => {
  describe('runners list', () => {
    itAuthenticated('should list runners', async () => {
      const { stdout, exitCode } = runCLI('runners list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Runner|No runners|ID|Name|Status/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('runners list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should return runners via API', async () => {
      const response = await apiCall('GET', '/api/runners');

      expect(response).toBeDefined();
      const runners = response.runners || response;
      expect(Array.isArray(runners) || typeof runners === 'object').toBe(true);
    });
  });

  describe('runners help', () => {
    it('should display runners help with all subcommands', () => {
      const { stdout, exitCode } = runCLI('runners --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('add');
      expect(stdout).toContain('setup');
      expect(stdout).toContain('status');
      expect(stdout).toContain('remove');
      expect(stdout).toContain('token');
      expect(stdout).toContain('update');
      expect(stdout).toContain('offline');
    });
  });
});
