/**
 * E2E Tests for Auth Commands
 * Tests: whoami, login status
 */

const { runCLI, apiCall, skipIfServerUnreachable, skipIfTokenInvalid, API_URL, TEST_TOKEN } = require('./helpers');

describe('CLI Auth Commands', () => {
  let serverReachable = true;
  let hasValidToken = true;

  beforeAll(async () => {
    serverReachable = !(await skipIfServerUnreachable());
    hasValidToken = !skipIfTokenInvalid();
  });

  describe('whoami', () => {
    it('should display current user info when authenticated', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      const { stdout, exitCode } = runCLI('whoami');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Current User|Name:|Email:/i);
    });

    it('should return user data via API', async () => {
      if (!serverReachable || !hasValidToken) {
        return;
      }

      // Make GET request without body
      const axios = require('axios');
      const response = await axios.get(`${require('./helpers').API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${require('./helpers').TEST_TOKEN}` },
      });

      expect(response.data).toBeDefined();
      // User should have basic properties
      expect(response.data.displayName || response.data.email || response.data.username).toBeDefined();
    });
  });

  describe('version and help', () => {
    it('should display version', () => {
      const { stdout, exitCode } = runCLI('--version');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Matches version number pattern
    });

    it('should display help', () => {
      const { stdout, exitCode } = runCLI('--help');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('controlinfra');
      expect(stdout).toContain('login');
      expect(stdout).toContain('logout');
      expect(stdout).toContain('repos');
      expect(stdout).toContain('scan');
    });
  });

  describe('unauthenticated access', () => {
    it('should show login prompt when not authenticated', () => {
      // Run without token
      const { stdout, stderr } = runCLI('whoami', {
        env: { CONTROLINFRA_TOKEN: '' },
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not logged in|login|authenticate/i);
    });
  });
});
