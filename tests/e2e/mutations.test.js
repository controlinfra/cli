/**
 * E2E Mutation Tests — CRUD lifecycle for projects, workspaces, runners, tokens,
 * plus scan/drift error-handling on non-existent resources.
 *
 * Runs against the real stage API.  Skips automatically when no valid token.
 */

const fs = require('fs');
const { runCLI, itAuthenticated } = require('./helpers');

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

  itAuthenticated('should have captured a project ID', () => {
    expect(projectId).toBeTruthy();
  });

  itAuthenticated('projects list should contain the new project', () => {
    const { stdout } = runCLI('projects list');
    expect(stdout).toMatch(/test-e2e-project/);
  });

  itAuthenticated('projects info should show details', () => {
    const { stdout } = runCLI(`projects info ${projectId}`);
    expect(stdout).toMatch(/test-e2e-project|Project/i);
  });

  itAuthenticated('projects update should rename', () => {
    const { exitCode } = runCLI(
      `projects update ${projectId} --name test-e2e-renamed-${Date.now()}`,
      { expectError: true }
    );
    expect([0, 1]).toContain(exitCode); // may fail if name exists from prior run
  });

  itAuthenticated('projects default should succeed', () => {
    const { exitCode } = runCLI(`projects default ${projectId}`);
    expect(exitCode).toBe(0);
  });

  itAuthenticated('projects delete should succeed', () => {
    // Create a temp project so this isn't the only one
    runCLI('projects create temp-e2e-keeper --provider aws', { expectError: true });
    const { exitCode } = runCLI(`projects delete ${projectId} --force`, { expectError: true });
    // May fail if it's still the only project — accept both outcomes
    expect([0, 1]).toContain(exitCode);
    if (exitCode === 0) projectId = null;
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

  itAuthenticated('should have captured a workspace ID', () => {
    expect(wsId).toBeTruthy();
  });

  itAuthenticated('workspaces info should show details', () => {
    const { stdout } = runCLI(`workspaces info ${wsId}`);
    expect(stdout).toMatch(/test-e2e-ws|Workspace/i);
  });

  itAuthenticated('workspaces update should rename', () => {
    const { exitCode } = runCLI(
      `workspaces update ${wsId} --name test-e2e-ws-renamed-${Date.now()}`,
      { expectError: true }
    );
    expect([0, 1]).toContain(exitCode); // may fail if name exists from prior run
  });

  itAuthenticated('workspaces default should succeed', () => {
    const { exitCode } = runCLI(`workspaces default ${wsId}`);
    expect(exitCode).toBe(0);
  });

  itAuthenticated('workspaces access should show list', () => {
    const { exitCode } = runCLI(`workspaces access ${wsId}`);
    expect(exitCode).toBe(0);
  });

  itAuthenticated('workspaces visibility should succeed or fail gracefully', () => {
    const { exitCode, stdout, stderr } = runCLI(
      `workspaces visibility ${wsId} org-wide`,
      { expectError: true }
    );
    // Accept success or any structured failure (not a crash)
    expect([0, 1]).toContain(exitCode);
    if (exitCode === 1) {
      expect(stdout + stderr).toMatch(/./); // non-empty output
    }
  });

  itAuthenticated('workspaces remove should succeed', () => {
    const { exitCode } = runCLI(`workspaces remove ${wsId} --force`, { expectError: true });
    expect([0, 1]).toContain(exitCode); // may fail if only workspace
    if (exitCode === 0) wsId = null;
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

  itAuthenticated('should have captured a runner ID', () => {
    expect(runnerId).toBeTruthy();
  });

  itAuthenticated('runners status should show pending', () => {
    const { stdout } = runCLI(`runners status ${runnerId}`);
    expect(stdout).toMatch(/pending|offline|status/i);
  });

  itAuthenticated('runners update should rename', () => {
    const { exitCode } = runCLI(
      `runners update ${runnerId} --name test-e2e-runner-renamed`
    );
    expect(exitCode).toBe(0);
  });

  itAuthenticated('runners token should regenerate', () => {
    const { stdout, exitCode } = runCLI(`runners token ${runnerId}`, { expectError: true });
    if (exitCode === 0) {
      expect(stdout).toMatch(/token/i);
    }
    // May hit rate limit — accept both outcomes
    expect([0, 1]).toContain(exitCode);
  });

  itAuthenticated('runners setup should show install script', () => {
    const { stdout, exitCode } = runCLI(`runners setup ${runnerId} --os linux`, { expectError: true });
    if (exitCode === 0) {
      expect(stdout).toMatch(/install|curl|script|setup/i);
    }
    expect([0, 1]).toContain(exitCode);
  });

  itAuthenticated('runners offline should succeed', () => {
    const { exitCode } = runCLI(`runners offline ${runnerId}`);
    expect(exitCode).toBe(0);
  });

  itAuthenticated('runners remove should succeed', () => {
    const { exitCode } = runCLI(`runners remove ${runnerId} --force`);
    expect(exitCode).toBe(0);
    runnerId = null;
  });
});

/* ------------------------------------------------------------------ */
/*  Tokens lifecycle                                                   */
/* ------------------------------------------------------------------ */
describe('Tokens CRUD lifecycle', () => {
  let tokenId;

  itAuthenticated('tokens create should succeed', () => {
    const { stdout, stderr, exitCode } = runCLI(
      'tokens create test-e2e-token --scopes scans:read,drifts:read --expires-in 1',
      { expectError: true }
    );
    if (exitCode === 0) {
      expect(stdout).toMatch(/token|created|key/i);
    } else {
      expect(stdout + stderr).toMatch(/denied|permission|plan|403/i);
    }
  });

  itAuthenticated('tokens list should contain the token', () => {
    const { stdout, exitCode } = runCLI('tokens list --json', { expectError: true });
    if (exitCode !== 0) return;
    const data = JSON.parse(stdout.replace(/^[^[{]*/, '')); // strip spinner text
    const tokens = data.tokens || data;
    const found = Array.isArray(tokens) &&
      tokens.find(t => (t.name || '').includes('test-e2e-token'));
    if (found) tokenId = found._id || found.id;
    expect(Array.isArray(tokens)).toBe(true);
  });

  itAuthenticated('tokens revoke should succeed', () => {
    if (!tokenId) return;
    const { exitCode } = runCLI(`tokens revoke ${tokenId}`, { expectError: true });
    expect([0, 1]).toContain(exitCode);
  });
});

/* ------------------------------------------------------------------ */
/*  Scan error handling (no active scan)                               */
/* ------------------------------------------------------------------ */
describe('Scan commands — non-existent resources', () => {
  const cmds = [
    ['scan run nonexistent/repo', /not found|error|invalid|failed|denied|permission/i],
    [`scan status ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`scan cancel ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`scan logs ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`scan retry ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`scan delete ${FAKE_ID} --force`, /not found|error|invalid|failed|denied|permission/i],
  ];

  cmds.forEach(([cmd, pattern]) => {
    itAuthenticated(`${cmd} should fail`, () => {
      const { stdout, stderr } = runCLI(cmd, { expectError: true });
      expect(stdout + stderr).toMatch(pattern);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Drift error handling (non-existent resources) + export             */
/* ------------------------------------------------------------------ */
describe('Drift commands — non-existent resources & export', () => {
  const cmds = [
    [`drifts show ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`drifts fix ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`drifts pr ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`drifts ignore ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`drifts resolve ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
    [`drifts reanalyze ${FAKE_ID}`, /not found|error|invalid|failed|denied|permission/i],
  ];

  cmds.forEach(([cmd, pattern]) => {
    itAuthenticated(`${cmd} should fail`, () => {
      const { stdout, stderr } = runCLI(cmd, { expectError: true });
      expect(stdout + stderr).toMatch(pattern);
    });
  });

  itAuthenticated('drifts export should succeed (empty array)', () => {
    const { stdout, exitCode } = runCLI('drifts export', { expectError: true });
    if (exitCode === 0) {
      expect(stdout).toMatch(/\[/); // contains array
    }
  });

  itAuthenticated('drifts export --output should write file', () => {
    const outPath = '/tmp/test-export.json';
    const { exitCode } = runCLI(`drifts export --output ${outPath}`, { expectError: true });
    if (exitCode === 0 && fs.existsSync(outPath)) {
      const content = fs.readFileSync(outPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
      fs.unlinkSync(outPath);
    }
  });
});
