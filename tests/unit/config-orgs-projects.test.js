'use strict';

jest.mock('../../src/api', () => ({
  orgs: {
    list: jest.fn(), create: jest.fn(), get: jest.fn(), update: jest.fn(), delete: jest.fn(),
    getMembers: jest.fn(), invite: jest.fn(), getInviteLink: jest.fn(), getInvitations: jest.fn(),
    revokeInvitation: jest.fn(), removeMember: jest.fn(), updateRole: jest.fn(),
    leave: jest.fn(), transfer: jest.fn(), acceptInvite: jest.fn(),
  },
  projects: {
    list: jest.fn(), create: jest.fn(), get: jest.fn(), update: jest.fn(),
    delete: jest.fn(), setDefault: jest.fn(),
  },
}));

jest.mock('../../src/config', () => ({
  requireAuth: jest.fn(), saveAuth: jest.fn(), getUser: jest.fn(), isAuthenticated: jest.fn(),
  getApiUrl: jest.fn(() => 'https://api.controlinfra.com'),
  getConfigPath: jest.fn(() => '/mock/config/path'),
  setConfig: jest.fn(), getConfig: jest.fn(), clearConfig: jest.fn(),
}));

const mockSpinner = { start: jest.fn().mockReturnThis(), stop: jest.fn(), succeed: jest.fn(), fail: jest.fn(), warn: jest.fn() };
jest.mock('../../src/output', () => ({
  brand: {
    purple: jest.fn((s) => s), purpleBold: jest.fn((s) => s), mid: jest.fn((s) => s),
    light: jest.fn((s) => s), cyan: jest.fn((s) => s), cyanBold: jest.fn((s) => s),
    gradient: Array(6).fill(jest.fn((s) => s)),
  },
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(), outputTable: jest.fn(), outputInfo: jest.fn(),
  outputBox: jest.fn(), formatRelativeTime: jest.fn(() => '2d ago'),
}));

jest.mock('inquirer', () => ({ prompt: jest.fn() }));

const api = require('../../src/api');
const output = require('../../src/output');
const inquirer = require('inquirer');
const { create: createOrg, update: updateOrg, deleteOrg, resolveOrgId } = require('../../src/commands/orgs');
const { invite, inviteLink, revoke, removeMember, updateRole, leave, transfer, accept } = require('../../src/commands/orgs-members');
const { create: createProject, update: updateProject, deleteProject, setDefault } = require('../../src/commands/projects');

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
const ORG_LIST = [{ id: 'org-abc-123', name: 'My Org', role: 'owner', memberCount: 3 }];
const mockOrgList = () => api.orgs.list.mockResolvedValue({ organizations: ORG_LIST });
beforeEach(() => { jest.clearAllMocks(); });

// ── Orgs CRUD ──

describe('orgs create', () => {
  it('should create an org and show success', async () => {
    api.orgs.create.mockResolvedValue({ organization: { id: 'org-new', name: 'New Org' } });
    await createOrg('New Org', {}, undefined);
    expect(api.orgs.create).toHaveBeenCalledWith({ name: 'New Org' });
    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('New Org'));
  });
  it('should exit 1 on API error', async () => {
    api.orgs.create.mockRejectedValue(new Error('Duplicate name'));
    await expect(createOrg('Dup', {}, undefined)).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('Duplicate name');
  });
});

describe('orgs update', () => {
  it('should resolve id and update', async () => {
    mockOrgList(); api.orgs.update.mockResolvedValue({ organization: { name: 'Renamed' } });
    await updateOrg('abc-123', { name: 'Renamed' }, undefined);
    expect(api.orgs.update).toHaveBeenCalledWith('org-abc-123', { name: 'Renamed' });
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Organization updated');
  });
  it('should warn when no updates specified', async () => {
    mockOrgList();
    await updateOrg('abc-123', {}, undefined);
    expect(mockSpinner.warn).toHaveBeenCalledWith('No updates specified');
  });
  it('should exit 1 when org not found', async () => {
    api.orgs.list.mockResolvedValue({ organizations: [] });
    await expect(updateOrg('nope', { name: 'x' }, undefined)).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith(expect.stringContaining('nope'));
  });
});

describe('orgs deleteOrg', () => {
  it('should delete with --force', async () => {
    mockOrgList(); api.orgs.delete.mockResolvedValue({});
    await deleteOrg('abc-123', { force: true });
    expect(api.orgs.delete).toHaveBeenCalledWith('org-abc-123');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Organization deleted');
  });
  it('should cancel when user declines confirmation', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await deleteOrg('abc-123', {});
    expect(api.orgs.delete).not.toHaveBeenCalled();
  });
  it('should exit 1 on API error', async () => {
    mockOrgList(); api.orgs.delete.mockRejectedValue(new Error('Forbidden'));
    await expect(deleteOrg('abc-123', { force: true })).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('Forbidden');
  });
});

describe('resolveOrgId', () => {
  it('should match exact id', async () => {
    mockOrgList();
    expect(await resolveOrgId('org-abc-123')).toBe('org-abc-123');
  });
  it('should match partial id suffix', async () => {
    mockOrgList();
    expect(await resolveOrgId('abc-123')).toBe('org-abc-123');
  });
  it('should match by name (case-insensitive)', async () => {
    mockOrgList();
    expect(await resolveOrgId('my org')).toBe('org-abc-123');
  });
  it('should return null when no match', async () => {
    api.orgs.list.mockResolvedValue({ organizations: [] });
    expect(await resolveOrgId('missing')).toBeNull();
  });
});

// ── Orgs Members ──

describe('orgs-members invite', () => {
  it('should invite with default role', async () => {
    mockOrgList(); api.orgs.invite.mockResolvedValue({ invitation: { id: 'inv-1' } });
    await invite('abc-123', 'bob@test.com', {}, undefined);
    expect(api.orgs.invite).toHaveBeenCalledWith('org-abc-123', 'bob@test.com', 'member');
  });
  it('should invite with specified role', async () => {
    mockOrgList(); api.orgs.invite.mockResolvedValue({});
    await invite('abc-123', 'admin@test.com', { role: 'admin' }, undefined);
    expect(api.orgs.invite).toHaveBeenCalledWith('org-abc-123', 'admin@test.com', 'admin');
  });
  it('should exit 1 on error', async () => {
    mockOrgList(); api.orgs.invite.mockRejectedValue(new Error('Limit reached'));
    await expect(invite('abc-123', 'x@y.com', {}, undefined)).rejects.toThrow('process.exit');
  });
});

describe('orgs-members inviteLink', () => {
  it('should generate and display link', async () => {
    mockOrgList(); api.orgs.getInviteLink.mockResolvedValue({ link: 'https://example.com/invite' });
    await inviteLink('abc-123', {}, undefined);
    expect(api.orgs.getInviteLink).toHaveBeenCalledWith('org-abc-123');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Invite link generated');
  });
});

describe('orgs-members revoke', () => {
  it('should revoke invitation', async () => {
    mockOrgList(); api.orgs.revokeInvitation.mockResolvedValue({});
    await revoke('abc-123', 'inv-99', {});
    expect(api.orgs.revokeInvitation).toHaveBeenCalledWith('org-abc-123', 'inv-99');
  });
  it('should exit 1 on error', async () => {
    mockOrgList(); api.orgs.revokeInvitation.mockRejectedValue(new Error('Not found'));
    await expect(revoke('abc-123', 'inv-99', {})).rejects.toThrow('process.exit');
  });
});

describe('orgs-members removeMember', () => {
  it('should remove member', async () => {
    mockOrgList(); api.orgs.removeMember.mockResolvedValue({});
    await removeMember('abc-123', 'user-1', {});
    expect(api.orgs.removeMember).toHaveBeenCalledWith('org-abc-123', 'user-1');
  });
});

describe('orgs-members updateRole', () => {
  it('should update role', async () => {
    mockOrgList(); api.orgs.updateRole.mockResolvedValue({});
    await updateRole('abc-123', 'user-1', 'admin', {});
    expect(api.orgs.updateRole).toHaveBeenCalledWith('org-abc-123', 'user-1', 'admin');
  });
});

describe('orgs-members leave', () => {
  it('should leave org', async () => {
    mockOrgList(); api.orgs.leave.mockResolvedValue({});
    await leave('abc-123', {});
    expect(api.orgs.leave).toHaveBeenCalledWith('org-abc-123');
  });
});

describe('orgs-members transfer', () => {
  it('should transfer ownership', async () => {
    mockOrgList(); api.orgs.transfer.mockResolvedValue({});
    await transfer('abc-123', 'user-2', {});
    expect(api.orgs.transfer).toHaveBeenCalledWith('org-abc-123', 'user-2');
  });
});

describe('orgs-members accept', () => {
  it('should accept invite by token', async () => {
    api.orgs.acceptInvite.mockResolvedValue({ organization: { name: 'Cool Org' } });
    await accept('tok-abc', {});
    expect(api.orgs.acceptInvite).toHaveBeenCalledWith('tok-abc');
    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('Cool Org'));
  });
  it('should exit 1 on invalid token', async () => {
    api.orgs.acceptInvite.mockRejectedValue(new Error('Invalid token'));
    await expect(accept('bad', {})).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('Invalid token');
  });
});

// ── Projects ──

describe('projects create', () => {
  it('should create with default provider aws', async () => {
    api.projects.create.mockResolvedValue({ project: { id: 'proj-1', name: 'P1' } });
    await createProject('P1', {}, undefined);
    expect(api.projects.create).toHaveBeenCalledWith({ name: 'P1', cloudProvider: 'aws' });
    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining('P1'));
  });
  it('should create with custom provider and description', async () => {
    api.projects.create.mockResolvedValue({ project: { id: 'proj-2' } });
    await createProject('P2', { provider: 'gcp', description: 'My GCP project' }, undefined);
    expect(api.projects.create).toHaveBeenCalledWith(
      { name: 'P2', cloudProvider: 'gcp', description: 'My GCP project' },
    );
  });
  it('should exit 1 on error', async () => {
    api.projects.create.mockRejectedValue(new Error('Quota exceeded'));
    await expect(createProject('P3', {}, undefined)).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('Quota exceeded');
  });
});

describe('projects update', () => {
  it('should update with name', async () => {
    api.projects.update.mockResolvedValue({ project: { name: 'Updated' } });
    await updateProject('proj-1', { name: 'Updated' }, undefined);
    expect(api.projects.update).toHaveBeenCalledWith('proj-1', { name: 'Updated' });
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Project updated');
  });
  it('should warn when no updates specified', async () => {
    await updateProject('proj-1', {}, undefined);
    expect(mockSpinner.warn).toHaveBeenCalledWith('No updates specified');
    expect(api.projects.update).not.toHaveBeenCalled();
  });
  it('should exit 1 on error', async () => {
    api.projects.update.mockRejectedValue(new Error('Not found'));
    await expect(updateProject('proj-1', { name: 'x' }, undefined)).rejects.toThrow('process.exit');
  });
});

describe('projects deleteProject', () => {
  it('should delete with --force', async () => {
    api.projects.delete.mockResolvedValue({});
    await deleteProject('proj-1', { force: true });
    expect(api.projects.delete).toHaveBeenCalledWith('proj-1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Project deleted');
  });
  it('should cancel when user declines', async () => {
    inquirer.prompt.mockResolvedValue({ confirm: false });
    await deleteProject('proj-1', {});
    expect(api.projects.delete).not.toHaveBeenCalled();
  });
  it('should exit 1 on error', async () => {
    api.projects.delete.mockRejectedValue(new Error('Forbidden'));
    await expect(deleteProject('proj-1', { force: true })).rejects.toThrow('process.exit');
  });
});

describe('projects setDefault', () => {
  it('should set default project', async () => {
    api.projects.setDefault.mockResolvedValue({});
    await setDefault('proj-1', {});
    expect(api.projects.setDefault).toHaveBeenCalledWith('proj-1');
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Default project updated');
  });
  it('should exit 1 on error', async () => {
    api.projects.setDefault.mockRejectedValue(new Error('Not found'));
    await expect(setDefault('proj-bad', {})).rejects.toThrow('process.exit');
    expect(output.outputError).toHaveBeenCalledWith('Not found');
  });
});
