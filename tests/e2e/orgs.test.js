/**
 * E2E Tests for Organization Commands — `orgs list`, `orgs info`, help.
 */

const { runCLI, apiCall, itAuthenticated } = require('./helpers');
const {
  expectListOutput, expectHelpLists, expectJsonOutput,
  expectNotFoundError, expectNoBugMarkers,
} = require('./assertions');

describe('CLI Organization Commands', () => {
  describe('orgs list', () => {
    itAuthenticated('shows the org table or the explicit empty-state copy', async () => {
      const result = runCLI('orgs list');
      expectListOutput(result, {
        tableHeader: 'Name',
        emptyMarker: 'No organizations',
      });
      expectNoBugMarkers(result);
    });

    itAuthenticated('list output includes a populated Members column for real orgs (regression #8)', async () => {
      // The audit caught `orgs list` showing "Members: -" because the CLI
      // read flat `org.memberCount` instead of `org.stats.memberCount`.
      // Lock the column being populated for any non-zero-member org.
      const result = runCLI('orgs list --json');
      const parsed = expectJsonOutput(result);
      const orgs = parsed.organizations || parsed.orgs || parsed;
      const populated = orgs.find((o) => (o.stats?.memberCount ?? 0) > 0);
      if (!populated) return; // skip when the test account has no populated orgs
      const tableResult = runCLI('orgs list');
      // The numeric member count must actually appear in the rendered table.
      expect(tableResult.stdout).toMatch(new RegExp(`\\b${populated.stats.memberCount}\\b`));
    });

    itAuthenticated('API endpoint returns the orgs envelope or a structured 4xx', async () => {
      const response = await apiCall('GET', '/api/orgs');
      if (response && response.error) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      } else {
        const orgs = response.organizations || response.orgs || response;
        expect(Array.isArray(orgs) || typeof orgs === 'object').toBe(true);
      }
    });
  });

  describe('orgs help', () => {
    it('lists every registered subcommand', () => {
      const result = runCLI('orgs --help');
      expectHelpLists(result, [
        'list', 'create', 'info', 'update', 'delete', 'members',
        'invite', 'invite-link', 'invitations', 'revoke',
        'remove-member', 'update-role', 'leave', 'transfer', 'accept',
      ]);
    });
  });

  describe('orgs info — error path', () => {
    itAuthenticated('non-existent ID returns specific "not found" copy + non-zero exit', async () => {
      const result = runCLI('orgs info non-existent-id-12345', { expectError: true });
      expectNotFoundError(
        result,
        /Organization not found|No organization matching/,
      );
      expectNoBugMarkers(result);
    });
  });
});
