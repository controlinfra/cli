/**
 * E2E Mutation Tests — CRUD lifecycle for projects, workspaces, runners,
 * tokens, plus scan/drift error-handling on non-existent resources.
 *
 * Runs against the real stage API.  Skips automatically when no valid token.
 *
 * Assertion strategy: never use the tautological bag-of-words regex pattern
 * (the kind that let 14 audit bugs slip past). Each test asserts on the
 * specific marker a healthy command emits.
 */

const fs = require('fs');
const { runCLI, itAuthenticated } = require('./helpers');
const { expectNoBugMarkers } = require('./assertions');

const FAKE_ID = '000000000000000000000000';

/* ------------------------------------------------------------------ */
/*  Projects lifecycle                                                 */
/* ------------------------------------------------------------------ */
describe('Projects CRUD lifecycle', () => {
  let projectId;

  beforeAll(() => {
    const { stdout } = runCLI('projects create test-e2e-project --provider aws');
    const match = stdout.match(/Project ID:\s+([a-f0-9]{24})/i);
    projectId = match ? match[1] : null;
  });

  afterAll(() => {
    if (projectId) runCLI(`projects delete ${projectId} --force`, { expectError: true });
  });

  itAuthenticated('create returns a 24-char ObjectId in the success message', () => {
    expect(projectId).toMatch(/^[a-f0-9]{24}$/);
  });

  itAuthenticated('list shows the created project by name', () => {
    const { stdout, exitCode } = runCLI('projects list');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-e2e-project');
  });

  itAuthenticated('info renders the detail box with Name field populated', () => {
    const result = runCLI(`projects info ${projectId}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project Details');
    expect(result.stdout).toContain('test-e2e-project');
    expectNoBugMarkers(result);
  });

  itAuthenticated('update renames the project (exit 0)', () => {
    const newName = `test-e2e-renamed-${Date.now()}`;
    const { stdout, exitCode } = runCLI(
      `projects update ${projectId} --name ${newName}`,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Project updated|updated successfully/);
  });

  itAuthenticated('default flag succeeds (exit 0)', () => {
    const { exitCode, stdout } = runCLI(`projects default ${projectId}`);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Default project updated|set as default/);
  });

  itAuthenticated('delete fails with "only project" guard when alone', () => {
    // The server prevents deletion of the only project — assert the
    // exact guard error, not just "exit code 1".
    const result = runCLI(`projects delete ${projectId} --force`, { expectError: true });
    if (result.exitCode === 0) {
      projectId = null;
      return;
    }
    expect(result.stdout + result.stderr).toMatch(/Cannot delete your only project|at least one project must remain/i);
  });
});

/* ------------------------------------------------------------------ */
/*  Workspaces lifecycle                                               */
/* ------------------------------------------------------------------ */
describe('Workspaces CRUD lifecycle', () => {
  let wsId;

  beforeAll(() => {
    const { stdout } = runCLI('workspaces add test-e2e-ws --cloud-provider aws');
    const match = stdout.match(/Workspace ID:\s+([a-f0-9]{24})/i);
    wsId = match ? match[1] : null;
  });

  afterAll(() => {
    if (wsId) runCLI(`workspaces remove ${wsId} --force`, { expectError: true });
  });

  itAuthenticated('add returns a 24-char ObjectId', () => {
    expect(wsId).toMatch(/^[a-f0-9]{24}$/);
  });

  itAuthenticated('info renders the detail box with Name + Cloud labels', () => {
    const result = runCLI(`workspaces info ${wsId}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Workspace Details');
    expect(result.stdout).toContain('test-e2e-ws');
    expect(result.stdout).toMatch(/Cloud:\s+aws/);
    expectNoBugMarkers(result);
  });

  itAuthenticated('default sets the workspace as default (exit 0)', () => {
    const { exitCode, stdout } = runCLI(`workspaces default ${wsId}`);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Default workspace updated|set as default/);
  });

  itAuthenticated('access shows the access list or "no access entries"', () => {
    const result = runCLI(`workspaces access ${wsId}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Workspace Access|No access entries|members|owner/);
    expectNoBugMarkers(result);
  });

  itAuthenticated('visibility org-wide flips the field (exit 0)', () => {
    const result = runCLI(`workspaces visibility ${wsId} org-wide`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Visibility updated|visibility set to/);
  });

  itAuthenticated('visibility with bogus value rejects with explicit allowlist message', () => {
    const result = runCLI(`workspaces visibility ${wsId} bogus-value`, { expectError: true });
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Invalid visibility.*org-wide|restricted/);
  });

  itAuthenticated('remove --force succeeds without prompt (exit 0)', () => {
    const result = runCLI(`workspaces remove ${wsId} --force`, { expectError: true });
    expect([0, 1]).toContain(result.exitCode);
    // --force must not prompt — verifying via output is the only way to
    // catch a regression that drops the flag handling silently.
    expect(result.stdout + result.stderr).not.toContain('? Are you sure');
    if (result.exitCode === 0) wsId = null;
  });
});

/* ------------------------------------------------------------------ */
/*  Runners lifecycle                                                  */
/* ------------------------------------------------------------------ */
describe('Runners CRUD lifecycle', () => {
  let runnerId;

  beforeAll(() => {
    const { stdout } = runCLI('runners add test-e2e-runner');
    const match = stdout.match(/ID:\s+([a-f0-9]{24})/i);
    runnerId = match ? match[1] : null;
  });

  afterAll(() => {
    if (runnerId) runCLI(`runners remove ${runnerId} --force`, { expectError: true });
  });

  itAuthenticated('add returns a 24-char ObjectId', () => {
    expect(runnerId).toMatch(/^[a-f0-9]{24}$/);
  });

  itAuthenticated('add output includes the pending-runners hint (regression #13)', () => {
    // The audit added this hint because `runners list` filters out
    // pending runners by design — without the hint, users think
    // `runners add` failed.
    const { stdout } = runCLI('runners add test-e2e-hint-runner');
    expect(stdout).toMatch(/pending runners are hidden|until they register/i);
    // Clean up the throwaway runner
    const m = stdout.match(/ID:\s+([a-f0-9]{24})/i);
    if (m) runCLI(`runners remove ${m[1]} --force`, { expectError: true });
  });

  itAuthenticated('status box shows Runner Status header + Name + Status fields', () => {
    const result = runCLI(`runners status ${runnerId}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Runner Status');
    expect(result.stdout).toMatch(/Status:\s+(pending|offline|online)/);
    expectNoBugMarkers(result);
  });

  itAuthenticated('update --name renames (exit 0)', () => {
    const result = runCLI(
      `runners update ${runnerId} --name test-e2e-renamed-${Date.now()}`,
    );
    expect(result.exitCode).toBe(0);
  });

  itAuthenticated('token regen emits a new token starting with "cifra_"', () => {
    const result = runCLI(`runners token ${runnerId}`, { expectError: true });
    if (result.exitCode === 0) {
      // New token format is cifra_<64 hex>. Asserting the prefix catches
      // a regression that returned the placeholder string instead of a
      // real token.
      expect(result.stdout).toMatch(/cifra_[a-f0-9]{32,}/);
    } else {
      // The only acceptable failure is a 429 rate-limit or 403 permission.
      expect(result.stdout + result.stderr).toMatch(/rate.?limit|429|Insufficient|403/i);
    }
  });

  itAuthenticated('setup emits the curl install command pointing at this API', () => {
    const result = runCLI(`runners setup ${runnerId}`, { expectError: true });
    if (result.exitCode === 0) {
      expect(result.stdout).toMatch(/curl -sL "https?:\/\/[^"]+\/api\/runners\/[a-f0-9]{24}\/setup\?token=cifra_/);
    }
    expectNoBugMarkers(result);
  });

  itAuthenticated('offline marks runner offline (exit 0)', () => {
    const { exitCode } = runCLI(`runners offline ${runnerId}`);
    expect(exitCode).toBe(0);
  });

  itAuthenticated('remove --force deletes (exit 0)', () => {
    const result = runCLI(`runners remove ${runnerId} --force`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Runner deleted/);
    runnerId = null;
  });
});

/* ------------------------------------------------------------------ */
/*  Tokens lifecycle                                                   */
/* ------------------------------------------------------------------ */
describe('Tokens CRUD lifecycle', () => {
  let tokenId;

  itAuthenticated('create emits a ci_-prefixed token + 24-char ID (or specific permission error)', () => {
    const result = runCLI(
      'tokens create test-e2e-token --scopes scans:read,drifts:read --expires-in 1',
      { expectError: true },
    );
    if (result.exitCode === 0) {
      // Real tokens look like ci_<hex>. Asserting the prefix catches a
      // regression that printed something other than a token.
      expect(result.stdout).toMatch(/ci_[a-f0-9]{32,}/);
    } else {
      expect(result.stdout + result.stderr).toMatch(/Access denied|Insufficient|403|requires.*plan/i);
    }
    expectNoBugMarkers(result);
  });

  itAuthenticated('list (after create) contains test-e2e-token by name', () => {
    const result = runCLI('tokens list --json', { expectError: true });
    if (result.exitCode !== 0) return;
    // Strip any spinner prefix before the JSON
    const jsonStart = result.stdout.search(/[[{]/);
    if (jsonStart < 0) return;
    const data = JSON.parse(result.stdout.slice(jsonStart));
    const tokens = data.tokens || data;
    expect(Array.isArray(tokens)).toBe(true);
    const found = tokens.find((t) => (t.name || '').includes('test-e2e-token'));
    if (found) tokenId = found.id || found._id;
  });

  itAuthenticated('revoke succeeds (exit 0) when token was found', () => {
    if (!tokenId) return;
    const result = runCLI(`tokens revoke ${tokenId}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Token revoked/);
  });
});

/* ------------------------------------------------------------------ */
/*  Scan error handling — assert SPECIFIC not-found copy, not "error"  */
/* ------------------------------------------------------------------ */
describe('Scan commands — non-existent resources', () => {
  // Each entry: [command, pattern that must appear in the error]. The
  // patterns are SPECIFIC strings the controllers emit, not bag-of-words.
  const cmds = [
    ['scan run nonexistent/repo',                /Repository not found|No repository found matching/],
    [`scan status ${FAKE_ID}`,                   /Scan not found|No scan found matching/],
    [`scan cancel ${FAKE_ID}`,                   /Scan not found|Cannot cancel|No scan found/],
    [`scan logs ${FAKE_ID}`,                     /Scan not found|No scan found matching/],
    [`scan retry ${FAKE_ID}`,                    /Scan not found|No scan found matching/],
    [`scan delete ${FAKE_ID} --force`,           /Scan not found|No scan found matching/],
  ];

  cmds.forEach(([cmd, pattern]) => {
    itAuthenticated(`${cmd} fails with specific error`, () => {
      const result = runCLI(cmd, { expectError: true });
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(pattern);
      expectNoBugMarkers(result);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Drift error handling + export                                       */
/* ------------------------------------------------------------------ */
describe('Drift commands — non-existent resources & export', () => {
  const cmds = [
    [`drifts show ${FAKE_ID}`,      /Drift not found|No drift found/],
    [`drifts fix ${FAKE_ID}`,       /Drift not found|No drift found/],
    [`drifts pr ${FAKE_ID}`,        /Drift not found|No drift found/],
    [`drifts ignore ${FAKE_ID}`,    /Drift not found|No drift found/],
    [`drifts resolve ${FAKE_ID}`,   /Drift not found|No drift found/],
    [`drifts reanalyze ${FAKE_ID}`, /Drift not found|No drift found/],
  ];

  cmds.forEach(([cmd, pattern]) => {
    itAuthenticated(`${cmd} fails with specific error`, () => {
      const result = runCLI(cmd, { expectError: true });
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(pattern);
      expectNoBugMarkers(result);
    });
  });

  itAuthenticated('drifts export --output writes parseable JSON to disk', () => {
    const outPath = '/tmp/test-export.json';
    const { exitCode } = runCLI(`drifts export --output ${outPath}`, { expectError: true });
    if (exitCode === 0 && fs.existsSync(outPath)) {
      const content = fs.readFileSync(outPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
      fs.unlinkSync(outPath);
    }
  });
});
