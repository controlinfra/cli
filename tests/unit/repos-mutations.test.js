'use strict';

vi.mock('../../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  repos: {
    list: vi.fn(),
    get: vi.fn(),
    getStats: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listAvailable: vi.fn(),
  },
}));

vi.mock('../../src/config', async (importOriginal) => ({
  ...(await importOriginal()),
  requireAuth: vi.fn(),
  saveAuth: vi.fn(),
  getUser: vi.fn(),
  isAuthenticated: vi.fn(),
}));

// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockSpinner } = vi.hoisted(() => ({ mockSpinner: {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  warn: vi.fn(),
  set text(v) { this._text = v; },
  get text() { return this._text; },
} }));
vi.mock('../../src/output', async (importOriginal) => ({
  ...(await importOriginal()),
  brand: {
    hex: { purple: '#ac9fe0', cyan: '#bdedfa', shadow: '#3d3466' },
    purple: vi.fn((s) => s),
    purpleBold: vi.fn((s) => s),
    mid: vi.fn((s) => s),
    light: vi.fn((s) => s),
    cyan: vi.fn((s) => s),
    cyanBold: vi.fn((s) => s),
    gradient: Array(6).fill(vi.fn((s) => s)),
  },
  createSpinner: vi.fn(() => mockSpinner),
  outputError: vi.fn(),
  outputTable: vi.fn(),
  outputInfo: vi.fn(),
  outputBox: vi.fn(),
  formatRelativeTime: vi.fn(() => 'just now'),
  colorStatus: vi.fn((s) => s),
}));

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() }, prompt: vi.fn() }));

import * as api from '../../src/api.js';
import * as output from '../../src/output.js';
import inquirer from 'inquirer';
import { remove, info, stats, resolveRepoId } from '../../src/commands/repos.js';
import { add } from '../../src/commands/repos-add.js';
import { update } from '../../src/commands/repos-update.js';

beforeAll(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });

const jsonCommand = { parent: { parent: { opts: () => ({ json: true }) } } };
const noJsonCommand = { parent: { parent: { opts: () => ({ json: false }) } } };

describe('resolveRepoId', () => {
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
