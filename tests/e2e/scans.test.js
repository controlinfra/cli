/**
 * E2E Tests for Scan Commands — `scan list`, `scan status`, help, drift-gate flags.
 */

import { runCLI, apiCall, itAuthenticated } from './helpers.js';
import {
  expectListOutput, expectHelpLists, expectJsonOutput, expectHelpHasFlags,
  expectNotFoundError, expectNoBugMarkers,
} from './assertions.js';

describe('CLI Scan Commands', () => {
  describe('scan list', () => {
    itAuthenticated('shows the scan table or the explicit empty-state copy', async () => {
      const result = runCLI('scan list');
      expectListOutput(result, {
        tableHeader: 'Status',
        emptyMarker: 'No scans',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array', async () => {
      const result = runCLI('scan list --json');
      const parsed = expectJsonOutput(result);
      const scans = parsed.scans || parsed;
      expect(Array.isArray(scans)).toBe(true);
    });

    itAuthenticated('--limit emits a clean exit (and at most N rows)', async () => {
      const result = runCLI('scan list --limit 5 --json');
      const parsed = expectJsonOutput(result);
      const scans = parsed.scans || parsed;
      expect(scans.length).toBeLessThanOrEqual(5);
    });

    itAuthenticated('--repo accepts short IDs (regression #2 from audit)', async () => {
      // The audit caught `scan list --repo <short_id>` failing because the
      // server only accepted full 24-char ObjectIds — but CLI tables print
      // 8-char short IDs as the primary identifier. After the fix, both
      // short + full IDs must work.
      const reposResult = runCLI('repos list --json');
      const repos = expectJsonOutput(reposResult);
      const repoList = repos.repositories || repos.configs || repos;
      if (!Array.isArray(repoList) || repoList.length === 0) return;
      const fullId = repoList[0]._id || repoList[0].id;
      if (!fullId || fullId.length !== 24) return;
      const shortId = fullId.slice(-8);
      const result = runCLI(`scan list --repo ${shortId}`);
      // The command must succeed (zero exit) even when no scans exist —
      // pre-fix this hard-failed with "Failed to list scans".
      expect(result.exitCode).toBe(0);
      expectNoBugMarkers(result);
    });

    itAuthenticated('API endpoint returns the scans envelope or a structured 4xx', async () => {
      const response = await apiCall('GET', '/api/scans?limit=10');
      if (response && response.error) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      } else {
        const scans = response.scans || response;
        expect(Array.isArray(scans) || typeof scans === 'object').toBe(true);
      }
    });
  });

  describe('scan help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('scan --help');
      expectHelpLists(result, [
        'run', 'status', 'wait', 'list', 'cancel', 'logs', 'retry', 'delete',
      ]);
    });

    it('scan run --help exposes the drift-gate flags', () => {
      const result = runCLI('scan run --help');
      expectHelpHasFlags(result, [
        '--fail-on-drift', '--fail-on-severity', '--fail-on-new-only',
      ]);
    });

    it('scan wait --help exposes the drift-gate flags', () => {
      const result = runCLI('scan wait --help');
      expectHelpHasFlags(result, [
        '--fail-on-drift', '--fail-on-severity', '--fail-on-new-only',
      ]);
    });
  });

  describe('scan status — error path', () => {
    itAuthenticated('non-existent scan returns specific "not found" copy', async () => {
      const result = runCLI('scan status 0000000000000000aaaaaaaa', { expectError: true });
      expectNotFoundError(result, /Scan not found|No scan found matching/);
      expectNoBugMarkers(result);
    });
  });
});
