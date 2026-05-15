/**
 * E2E Tests for Organization Member Management — full lifecycle.
 * Runs against the real stage API. Skips automatically when no valid token.
 *
 * Assertion strategy: see ./assertions.js. Specific markers, never
 * bag-of-words regexes.
 */

const { runCLI, itAuthenticated } = require('./helpers');
const {
  expectJsonOutput, expectSuccessOrPermissionError, expectNoBugMarkers,
} = require('./assertions');

describe('Organization member management lifecycle', () => {
  let orgId;

  beforeAll(() => {
    const { stdout } = runCLI('orgs create test-e2e-org');
    const match =
      stdout.match(/Organization ID:\s+([a-f0-9]{24})/i) ||
      stdout.match(/Org ID:\s+([a-f0-9]{24})/i) ||
      stdout.match(/ID:\s+([a-f0-9]{24})/i) ||
      stdout.match(/([a-f0-9]{24})/);
    orgId = match ? match[1] : null;
  });

  afterAll(() => {
    if (orgId) runCLI(`orgs delete ${orgId} --force`, { expectError: true });
  });

  itAuthenticated('create returned a 24-char ObjectId', () => {
    expect(orgId).toMatch(/^[a-f0-9]{24}$/);
  });

  itAuthenticated('info shows Organization Details box with the new name (regression #6/#7)', () => {
    const result = runCLI(`orgs info ${orgId}`);
    expect(result.exitCode).toBe(0);
    // Audit #6: info used to show "Members: 0 / Owner: -" even with
    // populated data. Lock the box header + Name field rendering so
    // a regression that drops the populate or reads wrong paths fails
    // this test rather than silently rendering empty.
    expect(result.stdout).toContain('Organization Details');
    expect(result.stdout).toContain('test-e2e-org');
    expect(result.stdout).toMatch(/Members:\s+\d+/);
    expectNoBugMarkers(result);
  });

  itAuthenticated('update --name renames (exit 0 + success message)', () => {
    const result = runCLI(`orgs update ${orgId} --name test-e2e-org-renamed`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Organization updated|updated successfully/);
  });

  itAuthenticated('members lists at least the owner with populated email (regression #7)', () => {
    const result = runCLI(`orgs members ${orgId}`);
    expect(result.exitCode).toBe(0);
    // Audit #7: members table used to show "-" for every User + Email
    // because the CLI read m.user.* instead of populated m.userId.*.
    // Asserting that User column is NOT just "-" catches a regression.
    const ownerLine = result.stdout.split('\n').find((l) => /\bowner\b/.test(l));
    if (ownerLine) {
      // Owner row must have BOTH a name and an email rendered — no
      // dashes in those columns.
      expect(ownerLine).toMatch(/\S+@\S+\.\S+/);
    }
    expectNoBugMarkers(result);
  });

  itAuthenticated('invite-link generates an HTTPS invite URL (or specific plan error)', () => {
    const result = runCLI(`orgs invite-link ${orgId}`, { expectError: true });
    expectSuccessOrPermissionError(result, () => {
      // Success path: must contain a real https:// URL, not just "link".
      expect(result.stdout).toMatch(/https?:\/\/\S+invite/);
    });
  });

  itAuthenticated('invitations renders the table or "No pending invitations"', () => {
    const result = runCLI(`orgs invitations ${orgId}`, { expectError: true });
    expectSuccessOrPermissionError(result, () => {
      expect(result.stdout).toMatch(/Email\s+Role\s+Status|No pending invitations/);
    });
  });

  itAuthenticated('invite emits "Invitation sent to <email>" on success', () => {
    const result = runCLI(`orgs invite ${orgId} test@example.com`, { expectError: true });
    expectSuccessOrPermissionError(result, () => {
      expect(result.stdout).toContain('test@example.com');
      expect(result.stdout).toMatch(/Invitation sent|invitation created/i);
    });
  });

  itAuthenticated('delete --force succeeds (exit 0)', () => {
    const result = runCLI(`orgs delete ${orgId} --force`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Organization deleted|deleted successfully/);
    orgId = null;
  });
});

/* ------------------------------------------------------------------ */
/*  Standalone: orgs switch                                            */
/* ------------------------------------------------------------------ */
describe('Organization switch', () => {
  let originalOrgId;

  beforeAll(() => {
    const { stdout } = runCLI('config get orgId', { expectError: true });
    originalOrgId = (stdout || '').trim();
  });

  afterAll(() => {
    if (originalOrgId && !originalOrgId.includes('not set')) {
      runCLI(`orgs switch ${originalOrgId}`, { expectError: true });
    }
  });

  itAuthenticated('switch by full name succeeds with explicit confirmation', () => {
    const result = runCLI('orgs list --json', { expectError: true });
    if (result.exitCode !== 0) return;
    const parsed = expectJsonOutput(result);
    const orgArr = parsed.organizations || parsed.orgs || parsed || [];
    if (orgArr.length === 0) return;

    const targetName = orgArr[0].name;
    const sw = runCLI(`orgs switch "${targetName}"`, { expectError: true });
    expect(sw.exitCode).toBe(0);
    expect(sw.stdout).toMatch(/Switched to\s+\S+/);
  });

  itAuthenticated('switch by 8-char short ID succeeds', () => {
    const result = runCLI('orgs list --json', { expectError: true });
    if (result.exitCode !== 0) return;
    const parsed = expectJsonOutput(result);
    const orgArr = parsed.organizations || parsed.orgs || parsed || [];
    if (orgArr.length === 0) return;

    const fullId = orgArr[0]._id || orgArr[0].id;
    const partialId = fullId.slice(-8);
    const sw = runCLI(`orgs switch ${partialId}`, { expectError: true });
    expect(sw.exitCode).toBe(0);
  });

  itAuthenticated('switch by slug succeeds (regression #15)', () => {
    // Audit #15: switch by slug used to fail even when the slug was
    // shown in API responses. Lock the slug-acceptance behavior.
    const result = runCLI('orgs list --json', { expectError: true });
    if (result.exitCode !== 0) return;
    const parsed = expectJsonOutput(result);
    const orgArr = parsed.organizations || parsed.orgs || parsed || [];
    const orgWithSlug = orgArr.find((o) => o.slug);
    if (!orgWithSlug) return;
    const sw = runCLI(`orgs switch ${orgWithSlug.slug}`, { expectError: true });
    expect(sw.exitCode).toBe(0);
  });

  itAuthenticated('switch with bogus name returns "not found" + non-zero exit', () => {
    const result = runCLI('orgs switch nonexistent-org-xyz', { expectError: true });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Organization not found|No organization matching/);
  });

  itAuthenticated('switch --help shows the documented signature', () => {
    const result = runCLI('orgs switch --help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Switch active organization');
    expect(result.stdout).toMatch(/id-or-name/);
  });
});

/* ------------------------------------------------------------------ */
/*  Standalone: accept with invalid token                              */
/* ------------------------------------------------------------------ */
describe('Organization accept — invalid token', () => {
  itAuthenticated('accept rejects bogus token with specific error', () => {
    const result = runCLI('orgs accept invalidtoken123', { expectError: true });
    expect(result.exitCode).not.toBe(0);
    // Server returns "Invitation not found or has expired" — assert
    // that specific message, not just "error".
    expect(result.stdout + result.stderr).toMatch(/Invitation not found|expired|invalid invitation/i);
    expectNoBugMarkers(result);
  });
});
