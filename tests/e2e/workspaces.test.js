/**
 * E2E Tests for Workspace Commands
 * Tests: workspaces list, workspaces info
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Workspace Commands', () => {
  describe('workspaces list', () => {
    itAuthenticated('should list workspaces', async () => {
      const { stdout, exitCode } = runCLI('workspaces list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Workspace|No workspaces|ID|Name/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('workspaces list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should return workspaces via API', async () => {
      const response = await apiCall('GET', '/api/workspaces');

      expect(response).toBeDefined();
      const workspaces = response.workspaces || response;
      expect(Array.isArray(workspaces) || typeof workspaces === 'object').toBe(true);
    });
  });

  describe('workspaces help', () => {
    it('should display workspaces help with all subcommands', () => {
      const { stdout, exitCode } = runCLI('workspaces --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('add');
      expect(stdout).toContain('info');
      expect(stdout).toContain('update');
      expect(stdout).toContain('remove');
      expect(stdout).toContain('default');
      expect(stdout).toContain('access');
      expect(stdout).toContain('access-add');
      expect(stdout).toContain('access-remove');
      expect(stdout).toContain('visibility');
    });
  });

  describe('workspaces info', () => {
    itAuthenticated('should show error for non-existent workspace', async () => {
      const { stdout, stderr, exitCode } = runCLI('workspaces info non-existent-id-12345', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
