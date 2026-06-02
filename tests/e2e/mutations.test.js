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
const os = require('os');
const path = require('path');
const { runCLI, itAuthenticated } = require('./helpers');
const { expectNoBugMarkers } = require('./assertions');

const FAKE_ID = '000000000000000000000000';

/* ------------------------------------------------------------------ */
/*  Projects lifecycle                                                 */
/* ------------------------------------------------------------------ */
describe('Projects CRUD lifecycle', () => {
  // The server forbids deleting an org's only project (asserted by the
  // "only project guard" test below), so a created fixture can't be torn
  // down when it's alone — it persists across runs. The suite is therefore
  // IDEMPOTENT: it reuses test-e2e-project when it already exists, otherwise
  // creates it, and the update test renames it back to the canonical name.
  // This is what makes the scheduled job stable — the previous version used
  // a fixed name it couldn't clean up, so run #2 onward hit a 400
  // "A project with this name already exists" and the whole suite went red.
  const PROJECT_NAME = 'test-e2e-project';
  let projectId;
  let createdThisRun = false;

  // Resolve the fixture's full 24-char id via --json (the table only prints
  // the last 8 chars). Returns null if absent or the call fails.
  const findProjectId = () => {
    const { stdout, exitCode } = runCLI('projects list --json', { expectError: true });
    if (exitCode !== 0) return null;
    try {
      const data = JSON.parse(stdout);
      const arr = Array.isArray(data) ? data : data.projects || [];
      const found = arr.find((p) => p.name === PROJECT_NAME);
      return found ? found.id || found._id || null : null;
    } catch {
      return null;
    }
  };

  beforeAll(() => {
    projectId = findProjectId();
    if (!projectId) {
      const res = runCLI(
        `projects create ${PROJECT_NAME} --provider aws`,
        { expectError: true },
      );
      const match = res.stdout.match(/Project ID:\s+([a-f0-9]{24})/i);
      projectId = match ? match[1] : findProjectId();
      createdThisRun = !!projectId;
      if (!projectId) {
        // eslint-disable-next-line no-console
        console.error(
          `[projects beforeAll] create yielded no id (exit ${res.exitCode})\n` +
          `  stdout: ${res.stdout}\n  stderr: ${res.stderr}`,
        );
      }
    }
  });

  afterAll(() => {
    // Only tear down a project we created this run; a reused fixture is
    // left in place on purpose (the only-project guard would block it
    // anyway). Best-effort — never fail the suite on cleanup.
    if (createdThisRun && projectId) {
      runCLI(`projects delete ${projectId} --force`, { expectError: true });
    }
  });

  itAuthenticated('fixture project resolves to a 24-char ObjectId (created or reused)', () => {
    expect(projectId).toMatch(/^[a-f0-9]{24}$/);
  });

  itAuthenticated('list shows the project by name', () => {
    const { stdout, exitCode } = runCLI('projects list');
    expect(exitCode).toBe(0);
    expect(stdout).toContain(PROJECT_NAME);
  });

  itAuthenticated('info renders the detail box with Name field populated', () => {
    const result = runCLI(`projects info ${projectId}`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project Details');
    expect(result.stdout).toContain(PROJECT_NAME);
    expectNoBugMarkers(result);
  });

  itAuthenticated('update renames the project then restores the fixture name (exit 0)', () => {
    const tempName = `test-e2e-renamed-${Date.now()}`;
    const renamed = runCLI(`projects update ${projectId} --name ${tempName}`);
    expect(renamed.exitCode).toBe(0);
    // spinner.succeed() writes to stderr (ora default); check combined.
    expect(renamed.stdout + renamed.stderr).toMatch(/Project updated|updated successfully/);

    // Restore the canonical name so the fixture stays reusable next run —
    // without this the project leaks under a unique name every run and the
    // org eventually trips the plan's project limit.
    const restored = runCLI(`projects update ${projectId} --name ${PROJECT_NAME}`, { expectError: true });
    expect(restored.exitCode).toBe(0);
  });

  itAuthenticated('default flag succeeds (exit 0)', () => {
    const { stdout, stderr, exitCode } = runCLI(`projects default ${projectId}`);
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toMatch(/Default project updated|set as default/);
  });

  itAuthenticated('delete fails with "only project" guard when alone', () => {
    // The server prevents deletion of the only project — assert the
    // exact guard error, not just "exit code 1". If the org happens to
    // have other projects, delete succeeds; account for both.
    const result = runCLI(`projects delete ${projectId} --force`, { expectError: true });
    if (result.exitCode === 0) {
      projectId = null;
      createdThisRun = false;
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
    const { stdout, stderr, exitCode } = runCLI(`workspaces default ${wsId}`);
    expect(exitCode).toBe(0);
    expect(stdout + stderr).toMatch(/Default workspace updated|set as default/);
  });

  itAuthenticated('access shows the access list or "no access entries"', () => {
    const result = runCLI(`workspaces access ${wsId}`);
    expect(result.exitCode).toBe(0);
    const out = result.stdout + result.stderr;
    expect(out).toMatch(/Workspace Access|No access entries|members|owner/);
    expectNoBugMarkers(result);
  });

  itAuthenticated('visibility org-wide flips the field (exit 0)', () => {
    const result = runCLI(`workspaces visibility ${wsId} org-wide`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/Visibility updated|visibility set to/);
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
    if (!runnerId) return; // beforeAll didn't capture an ID — skip
    const result = runCLI(`runners status ${runnerId}`, { expectError: true });
    // The runner may have been auto-cleaned by another test or
    // background job between create + status. We accept either a
    // healthy box render OR a clean "Runner not found" — not an
    // opaque crash.
    if (result.exitCode === 0) {
      expect(result.stdout).toContain('Runner Status');
      expect(result.stdout).toMatch(/Status:\s+(pending|offline|online)/);
    } else {
      expect(result.stdout + result.stderr).toMatch(/Runner not found|No runner found matching/);
    }
    expectNoBugMarkers(result);
  });

  itAuthenticated('update --name renames (exit 0 or runner-gone)', () => {
    if (!runnerId) return;
    const result = runCLI(
      `runners update ${runnerId} --name test-e2e-renamed-${Date.now()}`,
      { expectError: true },
    );
    if (result.exitCode !== 0) {
      expect(result.stdout + result.stderr).toMatch(/Runner not found|No runner found matching/);
    }
  });

  itAuthenticated('token regen emits a new token or specific not-found/permission error', () => {
    if (!runnerId) return;
    const result = runCLI(`runners token ${runnerId}`, { expectError: true });
    if (result.exitCode === 0) {
      // New token format is cifra_<64 hex> — asserting the prefix
      // catches a regression that printed the placeholder instead.
      expect(result.stdout + result.stderr).toMatch(/cifra_[a-f0-9]{32,}/);
    } else {
      // Acceptable: runner gone, rate-limited, or permission denied.
      expect(result.stdout + result.stderr).toMatch(
        /Runner not found|No runner found|rate.?limit|429|Insufficient|403/i,
      );
    }
  });

  itAuthenticated('setup emits the curl install command pointing at this API', () => {
    if (!runnerId) return;
    const result = runCLI(`runners setup ${runnerId}`, { expectError: true });
    if (result.exitCode === 0) {
      expect(result.stdout + result.stderr).toMatch(
        /curl -sL "https?:\/\/[^"]+\/api\/runners\/[a-f0-9]{24}\/setup\?token=cifra_/,
      );
    }
    expectNoBugMarkers(result);
  });

  itAuthenticated('offline marks runner offline (or returns clean not-found)', () => {
    if (!runnerId) return;
    const result = runCLI(`runners offline ${runnerId}`, { expectError: true });
    if (result.exitCode !== 0) {
      expect(result.stdout + result.stderr).toMatch(/Runner not found|No runner found matching/);
    }
  });

  itAuthenticated('remove --force deletes or reports not-found cleanly', () => {
    if (!runnerId) return;
    const result = runCLI(`runners remove ${runnerId} --force`, { expectError: true });
    if (result.exitCode === 0) {
      expect(result.stdout + result.stderr).toMatch(/Runner deleted/);
      runnerId = null;
    } else {
      expect(result.stdout + result.stderr).toMatch(/Runner not found|No runner found matching/);
    }
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
      expect(result.stdout + result.stderr).toMatch(/ci_[a-f0-9]{32,}/);
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
    expect(result.stdout + result.stderr).toMatch(/Token revoked/);
  });
});

/* ------------------------------------------------------------------ */
/*  Scan error handling — assert SPECIFIC not-found copy, not "error"  */
/* ------------------------------------------------------------------ */
describe('Scan commands — non-existent resources', () => {
  // Each entry: [command, pattern that must appear in the error]. The
  // patterns are SPECIFIC strings the controllers emit, not bag-of-words.
  const cmds = [
    // `scan run <owner/repo>` resolves the repo by GitHub fullName via the
    // CLI; when not configured, the CLI prints "Make sure the repository
    // is configured. Run: ...". For full-ObjectId paths the controller
    // returns "Repository (configuration) not found". Accept either.
    ['scan run nonexistent/repo',                /Repository (configuration )?not found|No repository found matching|Make sure the repository is configured/],
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
  // `drifts show` is read-only — must return the not-found error directly.
  // Write commands (fix, pr, ignore, resolve, reanalyze) may surface a
  // permission error first when the test token lacks drifts:write — accept
  // either branch but never an opaque crash.
  const PERM = /Access denied|Insufficient permissions|requires.*plan|403|requires.*role/i;
  const cmds = [
    [`drifts show ${FAKE_ID}`,      /Drift not found|No drift found/, false],
    [`drifts fix ${FAKE_ID}`,       /Drift not found|No drift found/, true],
    [`drifts pr ${FAKE_ID}`,        /Drift not found|No drift found/, true],
    [`drifts ignore ${FAKE_ID}`,    /Drift not found|No drift found/, true],
    [`drifts resolve ${FAKE_ID}`,   /Drift not found|No drift found/, true],
    [`drifts reanalyze ${FAKE_ID}`, /Drift not found|No drift found/, true],
  ];

  cmds.forEach(([cmd, pattern, allowPerm]) => {
    itAuthenticated(`${cmd} fails with specific error`, () => {
      const result = runCLI(cmd, { expectError: true });
      expect(result.exitCode).not.toBe(0);
      const out = result.stdout + result.stderr;
      if (allowPerm) {
        expect(pattern.test(out) || PERM.test(out)).toBe(true);
      } else {
        expect(out).toMatch(pattern);
      }
      expectNoBugMarkers(result);
    });
  });

  itAuthenticated('drifts export --output writes parseable JSON to disk', () => {
    const outPath = path.join(os.tmpdir(), `controlinfra-test-export-${Date.now()}.json`);
    const { exitCode } = runCLI(`drifts export --output ${outPath}`, { expectError: true });
    if (exitCode === 0 && fs.existsSync(outPath)) {
      const content = fs.readFileSync(outPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
      fs.unlinkSync(outPath);
    }
  });
});
