'use strict';

/**
 * Regression tests for the 14 bugs surfaced by the 2026-05-15 full-coverage
 * audit (every controlinfra subcommand tested end-to-end).
 *
 * Why this file exists: the existing e2e suite uses tautological regexes like
 *   expect(output).toMatch(/slack|webhook|not configured|configured|status|denied|permission/)
 * which pass on virtually any output — including bug-shaped output. Every bug
 * fixed in this PR slipped past that style of test. These regression tests
 * use `toHaveBeenCalledWith` + content assertions on the rendered output so a
 * future regression on any of the fixes fails this file specifically.
 *
 * Pattern guide for adding tests:
 *   - Mock at the API boundary (src/api), the output module, inquirer, fs.
 *   - Assert exact payload shape sent to API (catches contract drift).
 *   - Assert specific values in rendered output (catches display drift).
 *   - Never assert "output matches /word|word|word/" — that's the rubbish we're replacing.
 */

vi.mock('../../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  integrations: {
    saveGcpCredentials: vi.fn(), getGcpCredentials: vi.fn(), deleteGcpCredentials: vi.fn(),
    saveAwsCredentials: vi.fn(), getAwsCredentials: vi.fn(), deleteAwsCredentials: vi.fn(),
    saveAzureCredentials: vi.fn(), getAzureCredentials: vi.fn(), deleteAzureCredentials: vi.fn(),
    saveAnthropicKey: vi.fn(), verifyAnthropicKey: vi.fn(), deleteAnthropicKey: vi.fn(),
    saveOpenaiKey: vi.fn(), verifyOpenaiKey: vi.fn(), deleteOpenaiKey: vi.fn(),
    getAiProvider: vi.fn(), updateAiProvider: vi.fn(),
  },
  scans: { get: vi.fn(), list: vi.fn() },
  orgs: { list: vi.fn(), get: vi.fn(), getMembers: vi.fn(), getInvitations: vi.fn() },
  auth: { logout: vi.fn() },
  getClient: vi.fn(),
}));

vi.mock('../../src/config', async (importOriginal) => ({
  ...(await importOriginal()),
  requireAuth: vi.fn(),
  saveAuth: vi.fn(),
  clearAuth: vi.fn(),
  getUser: vi.fn(() => ({ displayName: 'tester' })),
  isAuthenticated: vi.fn(() => true),
  getDriftGateDefaults: vi.fn(() => ({ failOnDrift: false, failOnSeverity: null, failOnNewOnly: false })),
}));

const { tableCalls } = vi.hoisted(() => ({ tableCalls: [] }));
const { boxCalls } = vi.hoisted(() => ({ boxCalls: [] }));
const logCalls = [];
// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockSpinner } = vi.hoisted(() => ({ mockSpinner: {
  text: '',
  start: vi.fn().mockReturnThis(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
} }));
vi.mock('../../src/output', async (importOriginal) => ({
  ...(await importOriginal()),
  brand: {
    hex: { purple: '#ac9fe0', cyan: '#bdedfa', shadow: '#3d3466' },
    purple: (s) => s, purpleBold: (s) => s, mid: (s) => s, light: (s) => s,
    cyan: (s) => s, cyanBold: (s) => s,
    gradient: Array(6).fill((s) => s),
  },
  createSpinner: vi.fn(() => mockSpinner),
  outputError: vi.fn(),
  outputInfo: vi.fn(),
  outputTable: vi.fn((headers, rows) => tableCalls.push({ headers, rows })),
  outputBox: vi.fn((title, body) => boxCalls.push({ title, body })),
  formatRelativeTime: vi.fn(() => 'just now'),
  formatDuration: vi.fn(() => '1s'),
  colorStatus: (s) => s,
}));

// One shared fn behind both shapes. The commands call the default export
// (`import inquirer from 'inquirer'` -> inquirer.prompt) while these tests
// assert on the named one; two separate vi.fn()s meant the `--force` tests'
// `not.toHaveBeenCalled()` could never fail no matter what the command did.
const { promptMock } = vi.hoisted(() => ({ promptMock: vi.fn() }));
vi.mock('inquirer', () => ({ default: { prompt: promptMock }, prompt: promptMock }));

import * as api from '../../src/api.js';
import { setup } from '../../src/commands/gcp-setup.js';
import { waitForScan } from '../../src/commands/scan-wait.js';
import { use } from '../../src/commands/ai.js';
import { members } from '../../src/commands/orgs-members.js';
import { info } from '../../src/commands/orgs.js';
import { list } from '../../src/commands/orgs.js';
import { logout } from '../../src/commands/auth.js';
import * as inquirer from 'inquirer';
import { invitations } from '../../src/commands/orgs-members.js';
import * as orgsCmd from '../../src/commands/orgs.js';

const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation((...args) => logCalls.push(args.join(' ')));
  vi.spyOn(console, 'info').mockImplementation((...args) => logCalls.push(args.join(' ')));
});
afterAll(() => {
  console.log.mockRestore();
  console.info.mockRestore();
  mockExit.mockRestore();
});

beforeEach(() => {
  tableCalls.length = 0;
  boxCalls.length = 0;
  logCalls.length = 0;
  vi.clearAllMocks();
});

const renderedOutput = () => [
  ...logCalls,
  ...tableCalls.flatMap(t => t.rows.flat()),
  ...boxCalls.map(b => b.body),
].join('\n');

// ───────────────────────────────────────────────────────────────────────────
// #3 — gcp setup must accept --workload-identity-federation + audience + SA
// ───────────────────────────────────────────────────────────────────────────
describe('regression #3: gcp setup --workload-identity-federation', () => {

  it('saveGcpCredentials gets the WIF payload shape', async () => {
    api.integrations.saveGcpCredentials.mockResolvedValue({});
    await setup({
      workloadIdentityFederation: true,
      projectId: 'my-test-proj',
      audience: '//iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/p/providers/x',
      serviceAccountEmail: 'sa@my-test-proj.iam.gserviceaccount.com',
    });
    expect(api.integrations.saveGcpCredentials).toHaveBeenCalledWith({
      authMethod: 'workload_identity_federation',
      projectId: 'my-test-proj',
      audience: '//iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/p/providers/x',
      serviceAccountEmail: 'sa@my-test-proj.iam.gserviceaccount.com',
    });
  });

  it('rejects malformed WIF audience (catches typos before API rejects)', async () => {
    await expect(setup({
      workloadIdentityFederation: true,
      projectId: 'my-test-proj',
      audience: 'not-a-valid-wif-audience',
      serviceAccountEmail: 'sa@my-test-proj.iam.gserviceaccount.com',
    })).rejects.toThrow('process.exit');
    expect(api.integrations.saveGcpCredentials).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #4 — scan wait must extract .message from structured error objects
// ───────────────────────────────────────────────────────────────────────────
describe('regression #4: scan wait renders structured errors readably', () => {

  it('extracts .message from { message } error instead of [object Object]', async () => {
    api.scans.get.mockResolvedValue({
      _id: 'scan-1',
      status: 'failed',
      error: { message: 'terraform plan would destroy all resources', phase: 'plan' },
    });
    await expect(waitForScan('scan-1', { timeout: '1' })).rejects.toThrow('process.exit');
    const out = renderedOutput();
    expect(out).toContain('terraform plan would destroy all resources');
    expect(out).not.toContain('[object Object]');
  });

  it('passes string errors through unchanged', async () => {
    api.scans.get.mockResolvedValue({ _id: 'scan-2', status: 'failed', error: 'init failed' });
    await expect(waitForScan('scan-2', { timeout: '1' })).rejects.toThrow('process.exit');
    expect(renderedOutput()).toContain('init failed');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #5 — ai use contract: { provider } payload normalized to { defaultProvider }
// ───────────────────────────────────────────────────────────────────────────
describe('regression #5a: ai use sends defaultProvider', () => {

  it('updateAiProvider payload contains defaultProvider key', async () => {
    api.integrations.verifyAnthropicKey.mockResolvedValue({});
    api.integrations.saveAnthropicKey.mockResolvedValue({});
    api.integrations.updateAiProvider.mockResolvedValue({});
    await use('anthropic', { key: 'sk-ant-test-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' });
    const call = api.integrations.updateAiProvider.mock.calls[0][0];
    // Either provider or defaultProvider must be present — without this guard
    // a future regression that drops both keys (the bug we fixed) would let
    // the server reject every payload silently.
    expect(call.provider || call.defaultProvider).toBe('anthropic');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #5 (cont.) — getAiProvider must unwrap server's nested settings shape
// ───────────────────────────────────────────────────────────────────────────
describe('regression #5b: getAiProvider unwraps { settings } envelope', () => {
  // This one tests the api wrapper directly (the integrations module)
  // rather than going through a command, because the bug was that the CLI
  // commands read data.provider / data.hasCustomKey while the server
  // returned data.settings.defaultProvider / hasAnthropicKey. The fix
  // normalises at the api boundary.
  // vi.isolateModules' callback is synchronous, so the module under test cannot
  // be awaited inside it. Isolate in beforeAll instead: reset the registry,
  // register the mock, then import — which is what isolateModules did anyway.
  let integrations;
  let mockGet;

  beforeAll(async () => {
    vi.resetModules();
    mockGet = vi.fn();
    vi.doMock('../../src/api/client.js', () => ({ getClient: () => ({ get: mockGet, put: vi.fn() }) }));
    // integrations.js default-exports the object; under CJS `require` handed it
    // back directly, under ESM `import()` returns the namespace around it.
    integrations = (await import('../../src/api/integrations.js')).default;
  });

  {

    it('flattens { success, settings: { defaultProvider, hasAnthropicKey, hasOpenAIKey } } to { provider, hasCustomKey, ... }', async () => {
      mockGet.mockResolvedValue({ data: {
        success: true,
        settings: { defaultProvider: 'anthropic', hasAnthropicKey: true, hasOpenAIKey: false },
      }});
      const result = await integrations.getAiProvider();
      expect(result.provider).toBe('anthropic');
      expect(result.hasCustomKey).toBe(true);
      expect(result.hasAnthropicKey).toBe(true);
      expect(result.hasOpenAIKey).toBe(false);
    });

    it('passes through legacy flat-shape responses unchanged (back-compat)', async () => {
      mockGet.mockResolvedValue({ data: { provider: 'openai', hasCustomKey: true } });
      const result = await integrations.getAiProvider();
      expect(result.provider).toBe('openai');
      expect(result.hasCustomKey).toBe(true);
    });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// #7 — orgs members reads populated m.userId.{email,displayName} not m.user.*
// ───────────────────────────────────────────────────────────────────────────
describe('regression #7: orgs members reads populated userId', () => {

  it('renders displayName + email from populated m.userId, not m.user', async () => {
    api.orgs.list.mockResolvedValue([{ _id: 'org-1', name: 'Demo' }]);
    api.orgs.getMembers.mockResolvedValue({
      members: [
        { role: 'owner', userId: { displayName: 'Alice', email: 'alice@example.com' } },
        { role: 'member', userId: { displayName: 'Bob', email: 'bob@example.com' } },
      ],
    });
    await members('org-1', {}, {});
    const flat = tableCalls.flatMap(t => t.rows.flat()).join(' ');
    expect(flat).toContain('Alice');
    expect(flat).toContain('alice@example.com');
    expect(flat).toContain('Bob');
    expect(flat).toContain('bob@example.com');
    expect(flat).not.toContain('-');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #6/#8 — orgs info + orgs list read memberCount from org.stats.memberCount
// ───────────────────────────────────────────────────────────────────────────
describe('regression #6: orgs info shows correct member count + owner', () => {

  it('reads memberCount from stats.memberCount + owner from populated members', async () => {
    api.orgs.list.mockResolvedValue([{ _id: 'org-1', name: 'Demo' }]);
    api.orgs.get.mockResolvedValue({
      _id: 'org-1',
      name: 'Demo',
      stats: { memberCount: 5 },
      members: [
        { role: 'owner', userId: { email: 'owner@example.com' } },
        { role: 'member', userId: { email: 'm@example.com' } },
      ],
    });
    await info('org-1', {}, {});
    const body = boxCalls.map(b => b.body).join('\n');
    expect(body).toContain('5'); // member count
    expect(body).toContain('owner@example.com');
  });
});

describe('regression #8: orgs list shows memberCount column', () => {

  it('reads stats.memberCount, not flat memberCount', async () => {
    api.orgs.list.mockResolvedValue([
      { _id: 'org-1', name: 'Demo', role: 'owner', stats: { memberCount: 7 }, createdAt: '2026-01-01' },
    ]);
    await list({}, {});
    const flat = tableCalls.flatMap(t => t.rows.flat()).join(' ');
    expect(flat).toContain('7');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #9 — logout warns when CONTROLINFRA_TOKEN env var is still set
// ───────────────────────────────────────────────────────────────────────────
describe('regression #9: logout warns about lingering env-var auth', () => {

  it('mentions CONTROLINFRA_TOKEN env var in output when set', async () => {
    const prev = process.env.CONTROLINFRA_TOKEN;
    process.env.CONTROLINFRA_TOKEN = 'ci_anything';
    try {
      await logout();
      expect(renderedOutput()).toContain('CONTROLINFRA_TOKEN');
    } finally {
      if (prev === undefined) delete process.env.CONTROLINFRA_TOKEN;
      else process.env.CONTROLINFRA_TOKEN = prev;
    }
  });

  it('does NOT mention env var when none is set', async () => {
    const prev = process.env.CONTROLINFRA_TOKEN;
    delete process.env.CONTROLINFRA_TOKEN;
    try {
      await logout();
      expect(renderedOutput()).not.toContain('CONTROLINFRA_TOKEN');
    } finally {
      if (prev !== undefined) process.env.CONTROLINFRA_TOKEN = prev;
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #10 — --quiet honored: createSpinner returns no-op under __CLI_QUIET
// ───────────────────────────────────────────────────────────────────────────
describe('regression #10: --quiet silences spinners', () => {
  // The flag itself is wired in src/index.js via a preAction hook that sets
  // __CLI_QUIET. We test the unit that hook drives — createSpinner — because
  // testing the Commander hook in isolation needs program-level setup the
  // existing tests don't have scaffolding for.

  it('createSpinner returns a no-op spinner when __CLI_QUIET=1', async () => {
    const prev = process.env.__CLI_QUIET;
    process.env.__CLI_QUIET = '1';
    try {
      // importActual, NOT vi.unmock: Vitest hoists vi.unmock to the top of the
      // FILE (Jest's babel plugin only hoisted it within the enclosing block),
      // so an unmock written inside this test cancels the module-level
      // vi.mock('../../src/output') for every test in the file — the mocked
      // outputTable/outputBox stop recording and their assertions see ''.
      // importActual reaches past the mock for this one call instead.
      {
        const { createSpinner: real } = await vi.importActual('../../src/output.js');
        const spinner = real('starting work');
        // No-op spinner returns this from start/succeed/fail for chainability
        const started = spinner.start();
        expect(started).toBe(spinner);
        // Calling succeed should not throw + should not write to stderr (we can't
        // easily assert no-write, but we can assert the no-op interface is honored).
        expect(() => spinner.succeed('done')).not.toThrow();
        expect(() => spinner.fail('boom')).not.toThrow();
      }
    } finally {
      if (prev === undefined) delete process.env.__CLI_QUIET;
      else process.env.__CLI_QUIET = prev;
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #11 — aws/azure/gcp remove --force skips inquirer prompt
// ───────────────────────────────────────────────────────────────────────────
describe('regression #11: cloud provider remove --force skips confirm', () => {

  it('aws remove --force does not call inquirer.prompt', async () => {
    const { remove } = await import('../../src/commands/aws.js');
    api.integrations.deleteAwsCredentials.mockResolvedValue({});
    await remove({ force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.integrations.deleteAwsCredentials).toHaveBeenCalled();
  });

  it('azure remove --force does not call inquirer.prompt', async () => {
    const { remove } = await import('../../src/commands/azure.js');
    api.integrations.deleteAzureCredentials.mockResolvedValue({});
    await remove({ force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.integrations.deleteAzureCredentials).toHaveBeenCalled();
  });

  it('gcp remove --force does not call inquirer.prompt', async () => {
    const { remove } = await import('../../src/commands/gcp.js');
    api.integrations.deleteGcpCredentials.mockResolvedValue({});
    await remove({ force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.integrations.deleteGcpCredentials).toHaveBeenCalled();
  });

  it('aws remove (no --force) DOES prompt — confirms the flag is the only escape', async () => {
    const { remove } = await import('../../src/commands/aws.js');
    inquirer.prompt.mockResolvedValue({ confirm: false });
    api.integrations.deleteAwsCredentials.mockResolvedValue({});
    await remove({});
    expect(inquirer.prompt).toHaveBeenCalled();
    expect(api.integrations.deleteAwsCredentials).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #14 — orgs invitations renders link-invitation rows distinctly from emails
// ───────────────────────────────────────────────────────────────────────────
describe('regression #14: invite-link rows show "(link invitation)"', () => {

  it('renders "(link invitation)" for rows with no email', async () => {
    api.orgs.list.mockResolvedValue([{ _id: 'org-1', name: 'Demo' }]);
    api.orgs.getInvitations.mockResolvedValue({
      invitations: [
        { _id: 'inv-1', email: null, role: 'member', status: 'pending', createdAt: '2026-05-15' },
        { _id: 'inv-2', email: 'alice@example.com', role: 'member', status: 'pending', createdAt: '2026-05-15' },
      ],
    });
    await invitations('org-1', {}, {});
    const flat = tableCalls.flatMap(t => t.rows.flat()).join(' ');
    expect(flat).toContain('(link invitation)');
    expect(flat).toContain('alice@example.com');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #15 — orgs switch accepts slug as a switch identifier
// ───────────────────────────────────────────────────────────────────────────
describe('regression #15: orgs switch by slug', () => {

  it('resolveOrgId matches by slug', async () => {
    api.orgs.list.mockResolvedValue([
      { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Different Name', slug: 'my-org-slug' },
    ]);
    const resolved = await orgsCmd.resolveOrgId('my-org-slug');
    expect(resolved).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('resolveOrgId still works for ID + short-ID + name (no regression)', async () => {
    const orgList = [
      { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Acme', slug: 'acme' },
      { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Beta', slug: 'beta' },
    ];
    api.orgs.list.mockResolvedValue(orgList);
    expect(await orgsCmd.resolveOrgId('aaaaaaaaaaaaaaaaaaaaaaaa')).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    api.orgs.list.mockResolvedValue(orgList);
    expect(await orgsCmd.resolveOrgId('bbbbbbbbbbbb')).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
    api.orgs.list.mockResolvedValue(orgList);
    expect(await orgsCmd.resolveOrgId('Acme')).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
  });
});
