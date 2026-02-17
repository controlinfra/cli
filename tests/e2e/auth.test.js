/**
 * E2E Tests for Auth Commands
 * Tests: whoami, login status
 */

const os = require('os');
const path = require('path');
const { runCLI, itAuthenticated, API_URL, TEST_TOKEN } = require('./helpers');

describe('CLI Auth Commands', () => {
  describe('whoami', () => {
    itAuthenticated('should display current user info when authenticated', async () => {
      const { stdout, exitCode } = runCLI('whoami');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/Current User|Name:|Email:/i);
    });

    itAuthenticated('should return user data via API', async () => {
      const axios = require('axios');
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      });

      expect(response.data).toBeDefined();
      expect(response.data.displayName || response.data.email || response.data.username).toBeDefined();
    });
  });

  describe('version and help', () => {
    it('should display version', () => {
      const { stdout, exitCode } = runCLI('--version');

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
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
      // Use a temp APPDATA/XDG_CONFIG_HOME so the CLI doesn't read
      // the real stored token from the user's config file
      const tmpConfig = path.join(os.tmpdir(), `ci-test-noauth-${Date.now()}`);
      const { stdout, stderr } = runCLI('whoami', {
        env: {
          CONTROLINFRA_TOKEN: '',
          APPDATA: tmpConfig,
          XDG_CONFIG_HOME: tmpConfig,
        },
        expectError: true,
      });

      const output = stdout + stderr;
      expect(output).toMatch(/not logged in|login|authenticate/i);
    });
  });
});
