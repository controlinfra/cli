/**
 * E2E Tests for Organization Commands
 * Tests: orgs list, orgs info, orgs members
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');

describe('CLI Organization Commands', () => {
  describe('orgs list', () => {
    itAuthenticated('should list organizations', async () => {
      const { stdout, exitCode } = runCLI('orgs list');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Organization|No organizations|ID|Name/i);
    });

    itAuthenticated('should support JSON output', async () => {
      const { stdout, exitCode } = runCLI('orgs list --json');

      expect(exitCode).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    itAuthenticated('should return orgs via API', async () => {
      const response = await apiCall('GET', '/api/orgs');

      expect(response).toBeDefined();
      const orgs = response.organizations || response.orgs || response;
      expect(Array.isArray(orgs) || typeof orgs === 'object').toBe(true);
    });
  });

  describe('orgs help', () => {
    it('should display orgs help with all subcommands', () => {
      const { stdout, exitCode } = runCLI('orgs --help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('list');
      expect(stdout).toContain('create');
      expect(stdout).toContain('info');
      expect(stdout).toContain('update');
      expect(stdout).toContain('delete');
      expect(stdout).toContain('members');
      expect(stdout).toContain('invite');
      expect(stdout).toContain('invite-link');
      expect(stdout).toContain('invitations');
      expect(stdout).toContain('revoke');
      expect(stdout).toContain('remove-member');
      expect(stdout).toContain('update-role');
      expect(stdout).toContain('leave');
      expect(stdout).toContain('transfer');
      expect(stdout).toContain('accept');
    });
  });

  describe('orgs info', () => {
    itAuthenticated('should show error for non-existent org', async () => {
      const { stdout, stderr, exitCode } = runCLI('orgs info non-existent-id-12345', {
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not found|error|invalid|failed/i);
    });
  });

  describe('orgs members help', () => {
    it('should display members help with description', () => {
      const { stdout, exitCode } = runCLI('orgs members --help');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/member|organization/i);
    });
  });
});
