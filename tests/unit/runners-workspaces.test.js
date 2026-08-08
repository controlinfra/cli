'use strict';

vi.mock('../../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  runners: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), regenerateToken: vi.fn(), markOffline: vi.fn(), getSetup: vi.fn() },
  workspaces: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setDefault: vi.fn(), getAccess: vi.fn(), addAccess: vi.fn(), removeAccess: vi.fn(), setVisibility: vi.fn() },
}));
vi.mock('../../src/config', async (importOriginal) => ({
  ...(await importOriginal()), requireAuth: vi.fn(), saveAuth: vi.fn(), getUser: vi.fn(), isAuthenticated: vi.fn(), getApiUrl: vi.fn(() => 'https://api.controlinfra.com') }));
// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockSpinner } = vi.hoisted(() => ({ mockSpinner: { start: vi.fn().mockReturnThis(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn(), set text(v) { this._text = v; }, get text() { return this._text; } } }));
vi.mock('../../src/output', async (importOriginal) => ({
  ...(await importOriginal()),
  brand: { purple: vi.fn((s) => s), purpleBold: vi.fn((s) => s), mid: vi.fn((s) => s), light: vi.fn((s) => s), cyan: vi.fn((s) => s), cyanBold: vi.fn((s) => s), gradient: Array(6).fill(vi.fn((s) => s)) },
  createSpinner: vi.fn(() => mockSpinner), outputError: vi.fn(), outputTable: vi.fn(), outputInfo: vi.fn(), outputBox: vi.fn(), formatRelativeTime: vi.fn(() => 'just now'), colorStatus: vi.fn((s) => s),
}));
vi.mock('inquirer', () => ({ default: { prompt: vi.fn() }, prompt: vi.fn() }));

import * as api from '../../src/api.js';
import * as output from '../../src/output.js';
import inquirer from 'inquirer';
import { add as addRunner, status, remove as removeRunner, regenerateToken } from '../../src/commands/runners.js';
import { update as updateRunner, markOffline } from '../../src/commands/runners-actions.js';
import { setup, resolveRunnerId } from '../../src/commands/runners-setup.js';
import { add as addWs, update as updateWs, remove as removeWs, setDefault } from '../../src/commands/workspaces.js';
import { access, addAccess, removeAccess, setVisibility } from '../../src/commands/workspaces-access.js';

beforeAll(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
const jsonCmd = { parent: { parent: { opts: () => ({ json: true }) } } };
const noJsonCmd = { parent: { parent: { opts: () => ({ json: false }) } } };
const rList = { runners: [{ id: 'r1', _id: 'r1', name: 'runner-1' }] };
const wList = { workspaces: [{ _id: 'ws1', name: 'my-workspace' }] };

describe('runners add', () => {
  beforeEach(() => vi.clearAllMocks());
  it('creates a runner', async () => {
    api.runners.create.mockResolvedValue({ runner: { id: 'r1', name: 'test', token: 'tok' } });
    await addRunner('test', {}, noJsonCmd);
    expect(api.runners.create).toHaveBeenCalledWith({ name: 'test', labels: [] });
    expect(mockSpinner.succeed).toHaveBeenCalled();
  });
  it('outputs JSON', async () => {
    api.runners.create.mockResolvedValue({ runner: { id: 'r1', name: 'test' } });
    await addRunner('test', {}, jsonCmd);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"name"'));
  });
  it('exits on error', async () => {
    api.runners.create.mockRejectedValue(new Error('fail'));
    await expect(addRunner('test', {}, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('runners status', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows runner status', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.get.mockResolvedValue({ runner: { id: 'r1', name: 'runner-1', status: 'online' } });
    await status('r1', {}, noJsonCmd);
    expect(api.runners.get).toHaveBeenCalledWith('r1');
    expect(output.outputBox).toHaveBeenCalled();
  });
  it('exits when not found', async () => {
    api.runners.list.mockResolvedValue({ runners: [] });
    await expect(status('missing', {}, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('runners remove', () => {
  beforeEach(() => vi.clearAllMocks());
  it('removes with --force', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.delete.mockResolvedValue({});
    await removeRunner('r1', { force: true });
    expect(api.runners.delete).toHaveBeenCalledWith('r1');
  });
  it('cancels on declined prompt', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await removeRunner('r1', {});
    expect(api.runners.delete).not.toHaveBeenCalled();
  });
});

describe('runners regenerateToken', () => {
  beforeEach(() => vi.clearAllMocks());
  it('regenerates token', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.regenerateToken.mockResolvedValue({ token: 'new-tok' });
    await regenerateToken('r1', {}, noJsonCmd);
    expect(api.runners.regenerateToken).toHaveBeenCalledWith('r1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Token regenerated');
  });
  it('outputs JSON', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.regenerateToken.mockResolvedValue({ token: 'tok' });
    await regenerateToken('r1', {}, jsonCmd);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"token"'));
  });
  it('exits when not found', async () => {
    api.runners.list.mockResolvedValue({ runners: [] });
    await expect(regenerateToken('missing', {}, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('runners update', () => {
  beforeEach(() => vi.clearAllMocks());
  it('updates runner name', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.update.mockResolvedValue({ runner: { id: 'r1', name: 'new-name' } });
    await updateRunner('r1', { name: 'new-name' }, noJsonCmd);
    expect(api.runners.update).toHaveBeenCalledWith('r1', { name: 'new-name' });
  });
  it('warns when no updates', async () => {
    api.runners.list.mockResolvedValue(rList);
    await updateRunner('r1', {}, noJsonCmd);
    expect(mockSpinner.warn).toHaveBeenCalledWith('No updates specified');
  });
  it('exits on error', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.update.mockRejectedValue(new Error('fail'));
    await expect(updateRunner('r1', { name: 'x' }, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('runners markOffline', () => {
  beforeEach(() => vi.clearAllMocks());
  it('marks runner offline', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.markOffline.mockResolvedValue({});
    await markOffline('r1');
    expect(api.runners.markOffline).toHaveBeenCalledWith('r1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Runner marked as offline');
  });
  it('exits when not found', async () => {
    api.runners.list.mockResolvedValue({ runners: [] });
    await expect(markOffline('missing')).rejects.toThrow('process.exit called');
  });
});

describe('runners setup', () => {
  beforeEach(() => vi.clearAllMocks());
  it('generates setup script', async () => {
    api.runners.list.mockResolvedValue(rList);
    api.runners.regenerateToken.mockResolvedValue({ token: 'tok' });
    api.runners.getSetup.mockResolvedValue({ script: '#!/bin/bash' });
    await setup('r1', {}, noJsonCmd);
    expect(api.runners.regenerateToken).toHaveBeenCalledWith('r1');
    expect(api.runners.getSetup).toHaveBeenCalledWith('r1');
  });
  it('exits when not found', async () => {
    api.runners.list.mockResolvedValue({ runners: [] });
    await expect(setup('missing', {}, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('resolveRunnerId', () => {
  beforeEach(() => vi.clearAllMocks());
  it('resolves exact match', async () => {
    api.runners.list.mockResolvedValue({ runners: [{ id: 'r1' }] });
    expect(await resolveRunnerId('r1')).toBe('r1');
  });
  it('returns null when not found', async () => {
    api.runners.list.mockResolvedValue({ runners: [] });
    expect(await resolveRunnerId('missing')).toBeNull();
  });
});

describe('workspaces add', () => {
  beforeEach(() => vi.clearAllMocks());
  it('creates a workspace', async () => {
    api.workspaces.create.mockResolvedValue({ workspace: { _id: 'ws1' } });
    await addWs('my-ws', { cloudProvider: 'aws' });
    expect(api.workspaces.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'my-ws' }));
  });
  it('exits on invalid cloud provider', async () => {
    await expect(addWs('ws', { cloudProvider: 'bad' })).rejects.toThrow('process.exit called');
  });
  it('exits on API error', async () => {
    api.workspaces.create.mockRejectedValue(new Error('fail'));
    await expect(addWs('ws', { cloudProvider: 'aws' })).rejects.toThrow('process.exit called');
  });
});

describe('workspaces update', () => {
  beforeEach(() => vi.clearAllMocks());
  it('updates workspace', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.update.mockResolvedValue({ workspace: { _id: 'ws1', name: 'new' } });
    await updateWs('ws1', { name: 'new' }, noJsonCmd);
    expect(api.workspaces.update).toHaveBeenCalledWith('ws1', { name: 'new' });
  });
  it('warns when no updates', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    await updateWs('ws1', {}, noJsonCmd);
    expect(mockSpinner.warn).toHaveBeenCalledWith('No updates specified');
  });
  it('exits when not found', async () => {
    api.workspaces.list.mockResolvedValue({ workspaces: [] });
    await expect(updateWs('missing', { name: 'x' }, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('workspaces remove', () => {
  beforeEach(() => vi.clearAllMocks());
  it('removes with --force', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.delete.mockResolvedValue({});
    await removeWs('ws1', { force: true });
    expect(api.workspaces.delete).toHaveBeenCalledWith('ws1');
  });
  it('cancels on declined prompt', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await removeWs('ws1', {});
    expect(api.workspaces.delete).not.toHaveBeenCalled();
  });
});

describe('workspaces setDefault', () => {
  beforeEach(() => vi.clearAllMocks());
  it('sets default workspace', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.setDefault.mockResolvedValue({});
    await setDefault('ws1');
    expect(api.workspaces.setDefault).toHaveBeenCalledWith('ws1');
  });
  it('exits when not found', async () => {
    api.workspaces.list.mockResolvedValue({ workspaces: [] });
    await expect(setDefault('missing')).rejects.toThrow('process.exit called');
  });
});

describe('workspaces access', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists access', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.getAccess.mockResolvedValue({ members: [{ userId: 'u1', role: 'admin' }] });
    await access('ws1', {}, noJsonCmd);
    expect(output.outputTable).toHaveBeenCalled();
  });
  it('outputs JSON', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.getAccess.mockResolvedValue({ members: [{ userId: 'u1' }] });
    await access('ws1', {}, jsonCmd);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"userId"'));
  });
  it('exits when not found', async () => {
    api.workspaces.list.mockResolvedValue({ workspaces: [] });
    await expect(access('missing', {}, noJsonCmd)).rejects.toThrow('process.exit called');
  });
});

describe('workspaces addAccess', () => {
  beforeEach(() => vi.clearAllMocks());
  it('grants access with role', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.addAccess.mockResolvedValue({});
    await addAccess('ws1', 'user1', { role: 'editor' });
    expect(api.workspaces.addAccess).toHaveBeenCalledWith('ws1', 'user1', 'editor');
  });
  it('exits when not found', async () => {
    api.workspaces.list.mockResolvedValue({ workspaces: [] });
    await expect(addAccess('missing', 'u1', {})).rejects.toThrow('process.exit called');
  });
});

describe('workspaces removeAccess', () => {
  beforeEach(() => vi.clearAllMocks());
  it('removes access', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.removeAccess.mockResolvedValue({});
    await removeAccess('ws1', 'user1');
    expect(api.workspaces.removeAccess).toHaveBeenCalledWith('ws1', 'user1');
  });
  it('exits when not found', async () => {
    api.workspaces.list.mockResolvedValue({ workspaces: [] });
    await expect(removeAccess('missing', 'u1')).rejects.toThrow('process.exit called');
  });
});

describe('workspaces setVisibility', () => {
  beforeEach(() => vi.clearAllMocks());
  it('sets visibility to org-wide', async () => {
    api.workspaces.list.mockResolvedValue(wList);
    api.workspaces.setVisibility.mockResolvedValue({});
    await setVisibility('ws1', 'org-wide');
    expect(api.workspaces.setVisibility).toHaveBeenCalledWith('ws1', 'org-wide');
  });
  it('exits on invalid visibility', async () => {
    await expect(setVisibility('ws1', 'invalid')).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith(expect.stringContaining('Invalid visibility'));
  });
  it('exits when not found', async () => {
    api.workspaces.list.mockResolvedValue({ workspaces: [] });
    await expect(setVisibility('missing', 'org-wide')).rejects.toThrow('process.exit called');
  });
});
