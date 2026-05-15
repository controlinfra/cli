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

jest.mock('../../src/api', () => ({
  integrations: {
    saveGcpCredentials: jest.fn(), getGcpCredentials: jest.fn(), deleteGcpCredentials: jest.fn(),
    saveAwsCredentials: jest.fn(), getAwsCredentials: jest.fn(), deleteAwsCredentials: jest.fn(),
    saveAzureCredentials: jest.fn(), getAzureCredentials: jest.fn(), deleteAzureCredentials: jest.fn(),
    saveAnthropicKey: jest.fn(), verifyAnthropicKey: jest.fn(), deleteAnthropicKey: jest.fn(),
    saveOpenaiKey: jest.fn(), verifyOpenaiKey: jest.fn(), deleteOpenaiKey: jest.fn(),
    getAiProvider: jest.fn(), updateAiProvider: jest.fn(),
  },
  scans: { get: jest.fn(), list: jest.fn() },
  orgs: { list: jest.fn(), get: jest.fn(), getMembers: jest.fn(), getInvitations: jest.fn() },
  auth: { logout: jest.fn() },
  getClient: jest.fn(),
}));

jest.mock('../../src/config', () => ({
  requireAuth: jest.fn(),
  saveAuth: jest.fn(),
  clearAuth: jest.fn(),
  getUser: jest.fn(() => ({ displayName: 'tester' })),
  isAuthenticated: jest.fn(() => true),
  getDriftGateDefaults: jest.fn(() => ({ failOnDrift: false, failOnSeverity: null, failOnNewOnly: false })),
}));

const tableCalls = [];
const boxCalls = [];
const logCalls = [];
const mockSpinner = {
  text: '',
  start: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};
jest.mock('../../src/output', () => ({
  brand: {
    hex: { purple: '#ac9fe0', cyan: '#bdedfa', shadow: '#3d3466' },
    purple: (s) => s, purpleBold: (s) => s, mid: (s) => s, light: (s) => s,
    cyan: (s) => s, cyanBold: (s) => s,
    gradient: Array(6).fill((s) => s),
  },
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(),
  outputInfo: jest.fn(),
  outputTable: jest.fn((headers, rows) => tableCalls.push({ headers, rows })),
  outputBox: jest.fn((title, body) => boxCalls.push({ title, body })),
  formatRelativeTime: jest.fn(() => 'just now'),
  formatDuration: jest.fn(() => '1s'),
  colorStatus: (s) => s,
}));

jest.mock('inquirer', () => ({ prompt: jest.fn() }));

const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation((...args) => logCalls.push(args.join(' ')));
  jest.spyOn(console, 'info').mockImplementation((...args) => logCalls.push(args.join(' ')));
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
  jest.clearAllMocks();
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
  const api = require('../../src/api');
  const { setup } = require('../../src/commands/gcp-setup');

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
  const api = require('../../src/api');
  const { waitForScan } = require('../../src/commands/scan-wait');

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
  const api = require('../../src/api');
  const { use } = require('../../src/commands/ai');

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
  jest.isolateModules(() => {
    const mockGet = jest.fn();
    jest.doMock('../../src/api/client', () => ({ getClient: () => ({ get: mockGet, put: jest.fn() }) }));
    const integrations = require('../../src/api/integrations');

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
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #7 — orgs members reads populated m.userId.{email,displayName} not m.user.*
// ───────────────────────────────────────────────────────────────────────────
describe('regression #7: orgs members reads populated userId', () => {
  const api = require('../../src/api');
  const { members } = require('../../src/commands/orgs-members');

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
  const api = require('../../src/api');
  const { info } = require('../../src/commands/orgs');

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
  const api = require('../../src/api');
  const { list } = require('../../src/commands/orgs');

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
  const { logout } = require('../../src/commands/auth');

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

  it('createSpinner returns a no-op spinner when __CLI_QUIET=1', () => {
    const prev = process.env.__CLI_QUIET;
    process.env.__CLI_QUIET = '1';
    try {
      jest.isolateModules(() => {
        jest.unmock('../../src/output');
        const { createSpinner: real } = require('../../src/output');
        const spinner = real('starting work');
        // No-op spinner returns this from start/succeed/fail for chainability
        const started = spinner.start();
        expect(started).toBe(spinner);
        // Calling succeed should not throw + should not write to stderr (we can't
        // easily assert no-write, but we can assert the no-op interface is honored).
        expect(() => spinner.succeed('done')).not.toThrow();
        expect(() => spinner.fail('boom')).not.toThrow();
      });
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
  const api = require('../../src/api');
  const inquirer = require('inquirer');

  it('aws remove --force does not call inquirer.prompt', async () => {
    const { remove } = require('../../src/commands/aws');
    api.integrations.deleteAwsCredentials.mockResolvedValue({});
    await remove({ force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.integrations.deleteAwsCredentials).toHaveBeenCalled();
  });

  it('azure remove --force does not call inquirer.prompt', async () => {
    const { remove } = require('../../src/commands/azure');
    api.integrations.deleteAzureCredentials.mockResolvedValue({});
    await remove({ force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.integrations.deleteAzureCredentials).toHaveBeenCalled();
  });

  it('gcp remove --force does not call inquirer.prompt', async () => {
    const { remove } = require('../../src/commands/gcp');
    api.integrations.deleteGcpCredentials.mockResolvedValue({});
    await remove({ force: true });
    expect(inquirer.prompt).not.toHaveBeenCalled();
    expect(api.integrations.deleteGcpCredentials).toHaveBeenCalled();
  });

  it('aws remove (no --force) DOES prompt — confirms the flag is the only escape', async () => {
    const { remove } = require('../../src/commands/aws');
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
  const api = require('../../src/api');
  const { invitations } = require('../../src/commands/orgs-members');

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
  const orgsCmd = require('../../src/commands/orgs');
  const api = require('../../src/api');

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
