/**
 * E2E Tests for Project Commands
 * Tests: projects list, projects info
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Project Commands', () => {
  describe('projects list', () => {
    itAuthenticated('should list projects', async () => {
      const { stdout, exitCode } = runCLI('projects list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Project|No projects|ID|Name/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('projects list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should return projects via API', async () => {
      const response = await apiCall('GET', '/api/projects');

      expect(response).toBeDefined();
      const projects = response.projects || response;
      expect(Array.isArray(projects) || typeof projects === 'object').toBe(true);
    });
  });

  describe('projects help', () => {
    it('should display projects help with all subcommands', () => {
      const { stdout, exitCode } = runCLI('projects --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('create');
      expect(stdout).toContain('info');
      expect(stdout).toContain('update');
      expect(stdout).toContain('delete');
      expect(stdout).toContain('default');
    });
  });

  describe('projects info', () => {
    itAuthenticated('should show error for non-existent project', async () => {
      const { stdout, stderr, exitCode } = runCLI('projects info non-existent-id-12345', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid/i);
    });
  });
});
