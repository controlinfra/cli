/**
 * E2E Tests for Auth Commands — `whoami`, `--version`, `--help`, no-auth state.
 */

import os from 'os';
import path from 'path';
import axios from 'axios';
import { runCLI, itAuthenticated, API_URL, TEST_TOKEN } from './helpers.js';
import { expectDetailOutput, expectHelpLists, expectNoBugMarkers } from './assertions.js';

describe('CLI Auth Commands', () => {
  describe('whoami', () => {
    itAuthenticated('renders the Current User box with Name + Email labels', async () => {
      const result = runCLI('whoami');
      // Specific structural assertions on the actual rendered box.
      // Old test matched /Current User|Name:|Email:/ which passed if
      // ANY of those words appeared — including in a crash backtrace.
      expectDetailOutput(result, ['Current User', 'Name:', 'Email:', 'Role:']);
      expectNoBugMarkers(result);
    });

    itAuthenticated('API /api/auth/me returns a user with at least one identifier field', async () => {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      });
      expect(response.data).toBeDefined();
      // Must have AT LEAST ONE identifier — old test passed if any of
      // 3 fields was set, which is fine; tightening: the response must
      // have an _id or id, which is non-negotiable for a real user doc.
      expect(response.data._id || response.data.id).toBeTruthy();
    });
  });

  describe('version and help', () => {
    it('--version prints a semver-shaped string', () => {
      const result = runCLI('--version');
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
    });

    it('--help lists every top-level subcommand', () => {
      const result = runCLI('--help');
      // Every command group must appear — surfaces dropped registrations.
      expectHelpLists(result, [
        'login', 'logout', 'whoami', 'repos', 'scan', 'drifts', 'runners',
        'workspaces', 'slack', 'aws', 'azure', 'gcp', 'ai', 'orgs',
        'projects', 'config', 'tokens',
      ]);
    });
  });

  describe('unauthenticated access', () => {
    it('whoami without auth renders the explicit "Not logged in" CTA', () => {
      // Use temp config dir so we don't read stored creds.
      // whoami intentionally does NOT exit non-zero when unauth — it
      // prints a friendly CTA and returns. The behavior is locked here
      // so a regression that changes whoami to throw / hang surfaces.
      const tmpConfig = path.join(os.tmpdir(), `ci-test-noauth-${Date.now()}`);
      const result = runCLI('whoami', {
        env: { CONTROLINFRA_TOKEN: '', APPDATA: tmpConfig, XDG_CONFIG_HOME: tmpConfig },
        expectError: true,
      });
      // Specific copy emitted by auth.js#whoami — not just any output
      // containing "login".
      const out = result.stdout + result.stderr;
      expect(out).toMatch(/Not authenticated|Not logged in/);
      expect(out).toContain('controlinfra login');
    });
  });
});
