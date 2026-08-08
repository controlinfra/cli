/**
 * E2E Tests for Runner Commands — `runners list`, help.
 */

import { runCLI, apiCall, itAuthenticated } from './helpers.js';
import { expectListOutput, expectHelpLists, expectJsonOutput, expectNoBugMarkers } from './assertions.js';

describe('CLI Runner Commands', () => {
  describe('runners list', () => {
    itAuthenticated('shows the runner table or the explicit empty-state copy', async () => {
      const result = runCLI('runners list');
      expectListOutput(result, {
        // "Runner Status" / "Name" are column headers; the empty state
        // text is "No runners configured".
        tableHeader: 'Name',
        emptyMarker: 'No runners configured',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array', async () => {
      const result = runCLI('runners list --json');
      const parsed = expectJsonOutput(result);
      const runners = parsed.runners || parsed;
      expect(Array.isArray(runners)).toBe(true);
    });

    itAuthenticated('API endpoint returns runners envelope or structured 4xx', async () => {
      const response = await apiCall('GET', '/api/runners');
      if (response.error) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      } else {
        const runners = response.runners || response;
        expect(Array.isArray(runners) || typeof runners === 'object').toBe(true);
      }
    });
  });

  describe('runners help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('runners --help');
      expectHelpLists(result, [
        'list', 'add', 'setup', 'status', 'remove', 'token', 'update', 'offline',
      ]);
    });
  });
});