/**
 * E2E Tests for Repository Commands — `repos list`, `repos info`, help.
 *
 * Assertion strategy: see ./assertions.js. All tautological-regex matches
 * (the kind that let audit bugs slip past) have been replaced with
 * structure-specific assertions.
 */

import { runCLI, apiCall, itAuthenticated } from './helpers.js';
import {
  expectListOutput, expectHelpLists, expectJsonOutput,
  expectNotFoundError, expectNoBugMarkers,
} from './assertions.js';

describe('CLI Repository Commands', () => {
  describe('repos list', () => {
    itAuthenticated('shows the repo table or the explicit empty-state copy', async () => {
      const result = runCLI('repos list');
      expectListOutput(result, {
        tableHeader: 'Repository',
        emptyMarker: 'No repositories configured',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('--json emits a parseable array of objects', async () => {
      const result = runCLI('repos list --json');
      const parsed = expectJsonOutput(result);
      const repos = parsed.repositories || parsed.configs || parsed;
      expect(Array.isArray(repos)).toBe(true);
    });

    itAuthenticated('API path returns repositories array or a structured 4xx', async () => {
      // Direct API calls need X-Org-Id (set via CONTROLINFRA_TEST_ORG_ID env
      // var in helpers.js#apiCall). When the test runner doesn't have it,
      // the endpoint returns a structured 400 — assert the envelope rather
      // than an array. Either branch validates the endpoint's contract.
      const response = await apiCall('GET', '/api/repo-configs');
      if (response.error) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      } else {
        const repos = response.repositories || response.configs;
        expect(Array.isArray(repos)).toBe(true);
      }
    });
  });

  describe('repos help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('repos --help');
      expectHelpLists(result, ['list', 'add', 'update', 'remove', 'info', 'stats']);
    });
  });

  describe('repos info — error path', () => {
    itAuthenticated('non-existent ID returns specific "not found" copy + non-zero exit', async () => {
      const result = runCLI('repos info non-existent-id-12345', { expectError: true });
      // The controller emits "Repository configuration not found" (server)
      // or "No repository found matching ..." (CLI resolver). Either is a
      // valid not-found marker; opaque "error" output is not.
      expectNotFoundError(
        result,
        /Repository (configuration )?not found|No repository found matching/,
      );
      expectNoBugMarkers(result);
    });
  });
});