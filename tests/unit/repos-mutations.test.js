'use strict';

jest.mock('../../src/api', () => ({
  repos: {
    list: jest.fn(),
    get: jest.fn(),
    getStats: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    listAvailable: jest.fn(),
  },
}));

jest.mock('../../src/config', () => ({
  requireAuth: jest.fn(),
  saveAuth: jest.fn(),
  getUser: jest.fn(),
  isAuthenticated: jest.fn(),
}));

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
  set text(v) { this._text = v; },
  get text() { return this._text; },
};
jest.mock('../../src/output', () => ({
  brand: {
    purple: jest.fn((s) => s),
    purpleBold: jest.fn((s) => s),
    mid: jest.fn((s) => s),
    light: jest.fn((s) => s),
    cyan: jest.fn((s) => s),
    cyanBold: jest.fn((s) => s),
    gradient: Array(6).fill(jest.fn((s) => s)),
  },
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(),
  outputTable: jest.fn(),
  outputInfo: jest.fn(),
  outputBox: jest.fn(),
  formatRelativeTime: jest.fn(() => 'just now'),
  colorStatus: jest.fn((s) => s),
}));

jest.mock('inquirer', () => ({ prompt: jest.fn() }));

const api = require('../../src/api');
const output = require('../../src/output');
const inquirer = require('inquirer');
const { remove, info, stats, resolveRepoId } = require('../../src/commands/repos');
const { add } = require('../../src/commands/repos-add');
const { update } = require('../../src/commands/repos-update');

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });

const jsonCommand = { parent: { parent: { opts: () => ({ json: true }) } } };
const noJsonCommand = { parent: { parent: { opts: () => ({ json: false }) } } };

describe('resolveRepoId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves exact match', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'abc123' }] });
    expect(await resolveRepoId('abc123')).toBe('abc123');
  });

  it('resolves partial ID match', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'full-abc123' }] });
    expect(await resolveRepoId('abc123')).toBe('full-abc123');
  });

  it('resolves by name match', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'id1', repository: { fullName: 'owner/my-repo' } }] });
    expect(await resolveRepoId('my-repo')).toBe('id1');
  });

  it('returns null when not found', async () => {
    api.repos.list.mockResolvedValue({ configs: [] });
    expect(await resolveRepoId('missing')).toBeNull();
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes repo with --force', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.delete.mockResolvedValue({});
    await remove('repo1', { force: true });
    expect(api.repos.delete).toHaveBeenCalledWith('repo1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Repository removed successfully');
  });

  it('prompts for confirmation and cancels', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await remove('repo1', {});
    expect(api.repos.delete).not.toHaveBeenCalled();
  });

  it('exits when repo not found', async () => {
    api.repos.list.mockResolvedValue({ configs: [] });
    await expect(remove('missing', { force: true })).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith(expect.stringContaining('missing'));
  });

  it('exits on API error', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.delete.mockRejectedValue(new Error('Server error'));
    await expect(remove('repo1', { force: true })).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith('Server error');
  });
});

describe('info', () => {
  beforeEach(() => jest.clearAllMocks());

  it('displays repo info', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.get.mockResolvedValue({ repository: { repository: { fullName: 'owner/repo' } } });
    await info('repo1', {}, noJsonCommand);
    expect(api.repos.get).toHaveBeenCalledWith('repo1');
    expect(output.outputBox).toHaveBeenCalled();
  });

  it('outputs JSON when --json flag', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.get.mockResolvedValue({ repository: { name: 'repo' } });
    await info('repo1', {}, jsonCommand);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"name"'));
  });

  it('exits when repo not found', async () => {
    api.repos.list.mockResolvedValue({ configs: [] });
    await expect(info('missing', {}, noJsonCommand)).rejects.toThrow('process.exit called');
  });

  it('exits on API error', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.get.mockRejectedValue(new Error('Fetch failed'));
    await expect(info('repo1', {}, noJsonCommand)).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith('Fetch failed');
  });
});

describe('stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('displays stats', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.getStats.mockResolvedValue({ totalScans: 10, successfulScans: 8, failedScans: 2, totalDrifts: 5 });
    await stats('repo1', {}, noJsonCommand);
    expect(api.repos.getStats).toHaveBeenCalledWith('repo1');
    expect(output.outputBox).toHaveBeenCalled();
  });

  it('outputs JSON when --json flag', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.getStats.mockResolvedValue({ totalScans: 5 });
    await stats('repo1', {}, jsonCommand);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"totalScans"'));
  });

  it('exits when repo not found', async () => {
    api.repos.list.mockResolvedValue({ configs: [] });
    await expect(stats('missing', {}, noJsonCommand)).rejects.toThrow('process.exit called');
  });

  it('exits on API error', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.getStats.mockRejectedValue(new Error('Stats error'));
    await expect(stats('repo1', {}, noJsonCommand)).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith('Stats error');
  });
});

describe('add', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds a repo with valid format', async () => {
    api.repos.listAvailable.mockResolvedValue({ repositories: [{ fullName: 'owner/repo', id: 1, name: 'repo', owner: { login: 'owner' } }] });
    api.repos.create.mockResolvedValue({ config: { _id: 'new-id' } });
    await add('owner/repo', { cloudProvider: 'aws', accessKey: 'ak', secretKey: 'sk' });
    expect(api.repos.create).toHaveBeenCalledWith(expect.objectContaining({ cloudProvider: 'aws' }));
    expect(mockSpinner.succeed).toHaveBeenCalled();
  });

  it('exits on invalid format', async () => {
    await expect(add('badformat', {})).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith('Invalid repository format. Use: owner/repo');
  });

  it('exits when repo not found on GitHub', async () => {
    api.repos.listAvailable.mockResolvedValue({ repositories: [] });
    await expect(add('owner/missing', { cloudProvider: 'aws', accessKey: 'a', secretKey: 's' })).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('exits on create API error', async () => {
    api.repos.listAvailable.mockResolvedValue({ repositories: [{ fullName: 'owner/repo', id: 1, name: 'repo' }] });
    api.repos.create.mockRejectedValue(new Error('Create failed'));
    await expect(add('owner/repo', { cloudProvider: 'aws', accessKey: 'a', secretKey: 's' })).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith('Create failed');
  });
});

describe('update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates repo with branch option', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.update.mockResolvedValue({ config: { _id: 'repo1', branch: 'dev' } });
    await update('repo1', { branch: 'dev' }, noJsonCommand);
    expect(api.repos.update).toHaveBeenCalledWith('repo1', expect.objectContaining({ branch: 'dev' }));
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Repository updated successfully');
  });

  it('warns when no updates specified', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    await update('repo1', {}, noJsonCommand);
    expect(mockSpinner.warn).toHaveBeenCalledWith('No updates specified');
    expect(api.repos.update).not.toHaveBeenCalled();
  });

  it('exits when repo not found', async () => {
    api.repos.list.mockResolvedValue({ configs: [] });
    await expect(update('missing', { branch: 'dev' }, noJsonCommand)).rejects.toThrow('process.exit called');
  });

  it('exits on API error', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.update.mockRejectedValue(new Error('Update failed'));
    await expect(update('repo1', { branch: 'dev' }, noJsonCommand)).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith('Update failed');
  });

  it('outputs JSON when --json flag', async () => {
    api.repos.list.mockResolvedValue({ configs: [{ _id: 'repo1' }] });
    api.repos.update.mockResolvedValue({ config: { _id: 'repo1', branch: 'dev' } });
    await update('repo1', { branch: 'dev' }, jsonCommand);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"branch"'));
  });
});
