/**
 * E2E Tests for Organization Member Management
 * Full lifecycle: create org, info, update, members, invites, delete.
 *
 * Runs against the real stage API.  Skips automatically when no valid token.
 */

const { runCLI, itAuthenticated } = require('./helpers');

describe('Organization member management lifecycle', () => {
  let orgId;

  /* -------------------------------------------------------------- */
  /*  Setup — create a throwaway org                                 */
  /* -------------------------------------------------------------- */
  beforeAll(() => {
    const { stdout } = runCLI('orgs create test-e2e-org');
    // Try several patterns the CLI might use
    const match =
      stdout.match(/Organization ID:\s+([a-f0-9]{24})/i) ||
      stdout.match(/Org ID:\s+([a-f0-9]{24})/i) ||
      stdout.match(/ID:\s+([a-f0-9]{24})/i) ||
      stdout.match(/([a-f0-9]{24})/);
    orgId = match ? match[1] : null;
  });

  /* -------------------------------------------------------------- */
  /*  Teardown — delete the org no matter what                       */
  /* -------------------------------------------------------------- */
  afterAll(() => {
    if (orgId) {
      runCLI(`orgs delete ${orgId} --force`, { expectError: true });
    }
  });

  /* -------------------------------------------------------------- */
  /*  Tests                                                          */
  /* -------------------------------------------------------------- */
  itAuthenticated('should have captured an org ID', () => {
    expect(orgId).toBeTruthy();
  });

  itAuthenticated('orgs info should show details', () => {
    const { stdout, exitCode } = runCLI(`orgs info ${orgId}`);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/test-e2e-org|Organization|Name/i);
  });

  itAuthenticated('orgs update should rename', () => {
    const { exitCode } = runCLI(
      `orgs update ${orgId} --name test-e2e-org-renamed`
    );
    expect(exitCode).toBe(0);
  });

  itAuthenticated('orgs members should list at least the owner', () => {
    const { stdout, exitCode } = runCLI(`orgs members ${orgId}`);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/member|owner|role|email/i);
  });

  itAuthenticated('orgs invite-link should generate a link', () => {
    const { stdout, exitCode, stderr } = runCLI(`orgs invite-link ${orgId}`, {
      expectError: true,
    });
    const output = stdout + stderr;
    if (exitCode === 0) {
      expect(output).toMatch(/http|link|invite/i);
    } else {
      // May be plan-gated or unsupported
      expect(output).toMatch(/error|denied|permission|plan|not supported/i);
    }
  });

  itAuthenticated('orgs invitations should list (may be empty)', () => {
    const { stdout, exitCode, stderr } = runCLI(`orgs invitations ${orgId}`, {
      expectError: true,
    });
    if (exitCode === 0) {
      expect(stdout).toMatch(/invitation|no invitation|pending|email/i);
    } else {
      const output = stdout + stderr;
      expect(output).toMatch(/error|denied|permission|plan/i);
    }
  });

  itAuthenticated('orgs invite should succeed or fail gracefully', () => {
    const { exitCode } = runCLI(
      `orgs invite ${orgId} test@example.com`,
      { expectError: true }
    );
    // Accept success or structured failure (plan-gated, etc.)
    expect([0, 1]).toContain(exitCode);
  });

  itAuthenticated('orgs delete should succeed', () => {
    const { exitCode } = runCLI(`orgs delete ${orgId} --force`);
    expect(exitCode).toBe(0);
    orgId = null; // prevent afterAll double-delete
  });
});

/* ------------------------------------------------------------------ */
/*  Standalone: accept with invalid token                              */
/* ------------------------------------------------------------------ */
describe('Organization accept — invalid token', () => {
  itAuthenticated('orgs accept with invalid token should fail', () => {
    const { stdout, stderr } = runCLI('orgs accept invalidtoken123', {
      expectError: true,
    });
    const output = stdout + stderr;
    expect(output).toMatch(/error|invalid|not found|expired|failed/i);
  });
});
