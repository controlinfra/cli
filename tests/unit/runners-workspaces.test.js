'use strict';

jest.mock('../../src/api', () => ({
  runners: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), regenerateToken: jest.fn(), markOffline: jest.fn(), getSetup: jest.fn() },
  workspaces: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), setDefault: jest.fn(), getAccess: jest.fn(), addAccess: jest.fn(), removeAccess: jest.fn(), setVisibility: jest.fn() },
}));
jest.mock('../../src/config', () => ({ requireAuth: jest.fn(), saveAuth: jest.fn(), getUser: jest.fn(), isAuthenticated: jest.fn(), getApiUrl: jest.fn(() => 'https://api.controlinfra.com') }));
const mockSpinner = { start: jest.fn().mockReturnThis(), stop: jest.fn(), succeed: jest.fn(), fail: jest.fn(), warn: jest.fn(), set text(v) { this._text = v; }, get text() { return this._text; } };
jest.mock('../../src/output', () => ({
  brand: { purple: jest.fn((s) => s), purpleBold: jest.fn((s) => s), mid: jest.fn((s) => s), light: jest.fn((s) => s), cyan: jest.fn((s) => s), cyanBold: jest.fn((s) => s), gradient: Array(6).fill(jest.fn((s) => s)) },
  createSpinner: jest.fn(() => mockSpinner), outputError: jest.fn(), outputTable: jest.fn(), outputInfo: jest.fn(), outputBox: jest.fn(), formatRelativeTime: jest.fn(() => 'just now'), colorStatus: jest.fn((s) => s),
}));
jest.mock('inquirer', () => ({ prompt: jest.fn() }));

const api = require('../../src/api');
const output = require('../../src/output');
const inquirer = require('inquirer');
const { add: addRunner, status, remove: removeRunner, regenerateToken } = require('../../src/commands/runners');
const { update: updateRunner, markOffline } = require('../../src/commands/runners-actions');
const { setup, resolveRunnerId } = require('../../src/commands/runners-setup');
const { add: addWs, update: updateWs, remove: removeWs, setDefault } = require('../../src/commands/workspaces');
const { access, addAccess, removeAccess, setVisibility } = require('../../src/commands/workspaces-access');

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
const jsonCmd = { parent: { parent: { opts: () => ({ json: true }) } } };
const noJsonCmd = { parent: { parent: { opts: () => ({ json: false }) } } };
const rList = { runners: [{ id: 'r1', _id: 'r1', name: 'runner-1' }] };
const wList = { workspaces: [{ _id: 'ws1', name: 'my-workspace' }] };

describe('runners add', () => {
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
  beforeEach(() => jest.clearAllMocks());
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
