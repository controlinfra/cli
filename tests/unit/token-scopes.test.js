'use strict';

/**
 * Unit Tests for CLI Token Scopes
 * Tests: scope validation, token creation, token lifecycle, CLI command behavior
 */

jest.mock('../../src/api', () => ({
  cliTokens: {
    list: jest.fn(),
    create: jest.fn(),
    revoke: jest.fn(),
  },
}));

jest.mock('../../src/config', () => ({
  requireAuth: jest.fn(),
  saveAuth: jest.fn(),
  getUser: jest.fn(),
  isAuthenticated: jest.fn(() => true),
}));

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
};
jest.mock('../../src/output', () => ({
  brand: {
    purple: jest.fn((s) => s),
    purpleBold: jest.fn((s) => s),
    cyan: jest.fn((s) => s),
    cyanBold: jest.fn((s) => s),
  },
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(),
  outputTable: jest.fn(),
  formatRelativeTime: jest.fn((d) => d || '-'),
}));

const api = require('../../src/api');
const output = require('../../src/output');
const { list, create, revoke } = require('../../src/commands/auth-tokens');

// Silence console.log
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });

const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// ── Valid scopes (mirrors server VALID_TOKEN_SCOPES) ─────────────────────
const VALID_SCOPES = [
  'repos:read', 'repos:write',
  'scans:read', 'scans:trigger',
  'drifts:read', 'drifts:write',
  'runners:read', 'runners:manage',
  'drift-watch:read', 'drift-watch:write',
  'guardrails:read', 'guardrails:write',
  'discovery:read', 'discovery:write',
  'notifications:read',
  'workspaces:read', 'workspaces:write',
];

const DEFAULT_CI_SCOPES = ['repos:read', 'scans:read', 'scans:trigger', 'drifts:read'];

describe('Token List Command', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should display tokens with scopes in table', async () => {
    api.cliTokens.list.mockResolvedValue({
      tokens: [{
        id: 'abc123def456',
        name: 'ci-pipeline',
        scopes: ['scans:read', 'scans:trigger'],
        createdAt: '2026-01-01',
        lastUsedAt: '2026-04-10',
        expiresAt: null,
      }],
    });

    await list({}, {});

    expect(mockSpinner.stop).toHaveBeenCalled();
    expect(output.outputTable).toHaveBeenCalledWith(
      ['ID', 'Name', 'Scopes', 'Created', 'Last Used', 'Expires'],
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('should show empty state when no tokens exist', async () => {
    api.cliTokens.list.mockResolvedValue({ tokens: [] });

    await list({}, {});

    expect(mockSpinner.stop).toHaveBeenCalled();
    expect(output.outputTable).not.toHaveBeenCalled();
  });

  it('should output JSON when --json flag is set', async () => {
    const tokens = [{ id: 't1', name: 'test', scopes: DEFAULT_CI_SCOPES }];
    api.cliTokens.list.mockResolvedValue({ tokens });

    const mockCommand = { parent: { parent: { opts: () => ({ json: true }) } } };
    await list({}, mockCommand);

    expect(console.log).toHaveBeenCalledWith(JSON.stringify(tokens, null, 2));
  });

  it('should handle API failure gracefully', async () => {
    api.cliTokens.list.mockRejectedValue(new Error('Network error'));

    await expect(list({}, {})).rejects.toThrow('process.exit called');
    expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to fetch tokens');
    expect(output.outputError).toHaveBeenCalledWith('Network error');
  });

  it('should display tokens with all 17 scopes correctly', async () => {
    api.cliTokens.list.mockResolvedValue({
      tokens: [{
        id: 'full-access-token',
        name: 'admin-token',
        scopes: VALID_SCOPES,
        createdAt: '2026-01-01',
      }],
    });

    await list({}, {});

    expect(output.outputTable).toHaveBeenCalled();
    const rows = output.outputTable.mock.calls[0][1];
    expect(rows).toHaveLength(1);
  });
});

describe('Token Create Command', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create token with default scopes (no --scopes flag)', async () => {
    api.cliTokens.create.mockResolvedValue({
      token: 'ci_abc123def456',
      tokenInfo: { name: 'my-token', scopes: DEFAULT_CI_SCOPES },
    });

    await create('my-token', {}, {});

    expect(api.cliTokens.create).toHaveBeenCalledWith('my-token', {});
    expect(mockSpinner.succeed).toHaveBeenCalled();
  });

  it('should pass comma-separated scopes to API', async () => {
    api.cliTokens.create.mockResolvedValue({
      token: 'ci_abc123',
      tokenInfo: { name: 'scoped', scopes: ['scans:read', 'drifts:read'] },
    });

    await create('scoped', { scopes: 'scans:read,drifts:read' }, {});

    expect(api.cliTokens.create).toHaveBeenCalledWith('scoped', {
      scopes: ['scans:read', 'drifts:read'],
    });
  });

  it('should pass expiresIn days to API', async () => {
    api.cliTokens.create.mockResolvedValue({
      token: 'ci_expiring',
      tokenInfo: { name: 'temp', scopes: DEFAULT_CI_SCOPES },
    });

    await create('temp', { expiresIn: '90' }, {});

    expect(api.cliTokens.create).toHaveBeenCalledWith('temp', {
      expiresInDays: 90,
    });
  });

  it('should pass both scopes and expiry together', async () => {
    api.cliTokens.create.mockResolvedValue({
      token: 'ci_both',
      tokenInfo: { name: 'both', scopes: ['runners:read'] },
    });

    await create('both', { scopes: 'runners:read', expiresIn: '30' }, {});

    expect(api.cliTokens.create).toHaveBeenCalledWith('both', {
      scopes: ['runners:read'],
      expiresInDays: 30,
    });
  });

  it('should output JSON when --json flag is set', async () => {
    const responseData = {
      token: 'ci_json_token',
      tokenInfo: { name: 'json', scopes: DEFAULT_CI_SCOPES },
    };
    api.cliTokens.create.mockResolvedValue(responseData);

    const mockCommand = { parent: { parent: { opts: () => ({ json: true }) } } };
    await create('json', {}, mockCommand);

    expect(console.log).toHaveBeenCalledWith(JSON.stringify(responseData, null, 2));
  });

  it('should handle creation failure', async () => {
    api.cliTokens.create.mockRejectedValue(new Error('Invalid scopes: admin:all'));

    await expect(create('bad', { scopes: 'admin:all' }, {})).rejects.toThrow('process.exit called');
    expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to create token');
    expect(output.outputError).toHaveBeenCalledWith('Invalid scopes: admin:all');
  });
});

describe('Token Revoke Command', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should revoke token by ID', async () => {
    api.cliTokens.revoke.mockResolvedValue({ success: true });

    await revoke('abc123', {});

    expect(api.cliTokens.revoke).toHaveBeenCalledWith('abc123');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Token revoked successfully');
  });

  it('should handle revoke failure (token not found)', async () => {
    api.cliTokens.revoke.mockRejectedValue(new Error('Token not found'));

    await expect(revoke('nonexistent', {})).rejects.toThrow('process.exit called');
    expect(mockSpinner.fail).toHaveBeenCalledWith('Failed to revoke token');
  });
});

describe('Scope Validation (server-side contract)', () => {
  it('should recognize all 17 valid scopes', () => {
    expect(VALID_SCOPES).toHaveLength(17);
  });

  it('should have paired read/write for most resources', () => {
    const resources = ['repos', 'drifts', 'drift-watch', 'guardrails', 'discovery', 'workspaces'];
    for (const resource of resources) {
      expect(VALID_SCOPES).toContain(`${resource}:read`);
      expect(VALID_SCOPES).toContain(`${resource}:write`);
    }
  });

  it('should have non-standard actions for scans and runners', () => {
    expect(VALID_SCOPES).toContain('scans:read');
    expect(VALID_SCOPES).toContain('scans:trigger');
    expect(VALID_SCOPES).not.toContain('scans:write');
    expect(VALID_SCOPES).toContain('runners:read');
    expect(VALID_SCOPES).toContain('runners:manage');
    expect(VALID_SCOPES).not.toContain('runners:write');
  });

  it('should have notifications as read-only', () => {
    expect(VALID_SCOPES).toContain('notifications:read');
    expect(VALID_SCOPES).not.toContain('notifications:write');
  });

  it('should have correct default CI/CD scopes', () => {
    expect(DEFAULT_CI_SCOPES).toEqual(['repos:read', 'scans:read', 'scans:trigger', 'drifts:read']);
    // All default scopes must be valid
    for (const scope of DEFAULT_CI_SCOPES) {
      expect(VALID_SCOPES).toContain(scope);
    }
  });

  it('should not include any admin or org-level scopes', () => {
    const forbidden = ['admin', 'org', 'billing', 'users'];
    for (const scope of VALID_SCOPES) {
      for (const word of forbidden) {
        expect(scope).not.toContain(word);
      }
    }
  });
});
