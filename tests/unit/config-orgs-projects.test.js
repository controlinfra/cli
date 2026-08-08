'use strict';

vi.mock('../../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  orgs: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn(),
    getMembers: vi.fn(), invite: vi.fn(), getInviteLink: vi.fn(), getInvitations: vi.fn(),
    revokeInvitation: vi.fn(), removeMember: vi.fn(), updateRole: vi.fn(),
    leave: vi.fn(), transfer: vi.fn(), acceptInvite: vi.fn(),
  },
  projects: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(),
    delete: vi.fn(), setDefault: vi.fn(),
  },
}));

// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockCliConfig } = vi.hoisted(() => ({ mockCliConfig: { set: vi.fn(), get: vi.fn() } }));
vi.mock('../../src/config', async (importOriginal) => ({
  ...(await importOriginal()),
  requireAuth: vi.fn(), saveAuth: vi.fn(), getUser: vi.fn(), isAuthenticated: vi.fn(),
  getApiUrl: vi.fn(() => 'https://api.controlinfra.com'),
  getConfigPath: vi.fn(() => '/mock/config/path'),
  setConfig: vi.fn(), getConfig: vi.fn(), clearConfig: vi.fn(),
  config: mockCliConfig,
}));

// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockSpinner } = vi.hoisted(() => ({ mockSpinner: { start: vi.fn().mockReturnThis(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() } }));
vi.mock('../../src/output', async (importOriginal) => ({
  ...(await importOriginal()),
  brand: {
    hex: { purple: '#ac9fe0', cyan: '#bdedfa', shadow: '#3d3466' },
    purple: vi.fn((s) => s), purpleBold: vi.fn((s) => s), mid: vi.fn((s) => s),
    light: vi.fn((s) => s), cyan: vi.fn((s) => s), cyanBold: vi.fn((s) => s),
    gradient: Array(6).fill(vi.fn((s) => s)),
  },
  createSpinner: vi.fn(() => mockSpinner),
  outputError: vi.fn(), outputTable: vi.fn(), outputInfo: vi.fn(),
  outputBox: vi.fn(), formatRelativeTime: vi.fn(() => '2d ago'),
}));

vi.mock('inquirer', () => ({ default: { prompt: vi.fn() }, prompt: vi.fn() }));

import * as api from '../../src/api.js';
import * as output from '../../src/output.js';
import inquirer from 'inquirer';
import { create as createOrg, update as updateOrg, deleteOrg, resolveOrgId, switchOrg } from '../../src/commands/orgs.js';
import { invite, inviteLink, revoke, removeMember, updateRole, leave, transfer, accept } from '../../src/commands/orgs-members.js';
import { create as createProject, update as updateProject, deleteProject, setDefault } from '../../src/commands/projects.js';

beforeAll(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
const ORG_LIST = [{ id: 'org-abc-123', name: 'My Org', role: 'owner', memberCount: 3 }];
const mockOrgList = () => api.orgs.list.mockResolvedValue({ organizations: ORG_LIST });
beforeEach(() => { vi.clearAllMocks(); });

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

// ── Orgs Switch ──

describe('orgs switchOrg', () => {
  beforeEach(() => vi.clearAllMocks());
  it('should switch by name', async () => {
    api.orgs.list.mockResolvedValue({ organizations: [
      { _id: 'org-1', name: 'My Org' },
      { _id: 'org-2', name: 'Other Org' },
    ]});
    await switchOrg('My Org');
    expect(mockCliConfig.set).toHaveBeenCalledWith('orgId', 'org-1');
  });
  it('should switch by partial ID', async () => {
    api.orgs.list.mockResolvedValue({ organizations: [
      { _id: 'org-abc-123', name: 'Test' },
    ]});
    await switchOrg('abc-123');
    expect(mockCliConfig.set).toHaveBeenCalledWith('orgId', 'org-abc-123');
  });
  it('should switch via interactive picker when no argument', async () => {
    const orgData = { _id: 'org-picked', name: 'Picked Org' };
    api.orgs.list.mockResolvedValue({ organizations: [orgData, { _id: 'org-2', name: 'Other' }] });
    inquirer.prompt.mockResolvedValue({ org: orgData });
    await switchOrg(undefined);
    expect(inquirer.prompt).toHaveBeenCalled();
    expect(mockCliConfig.set).toHaveBeenCalledWith('orgId', 'org-picked');
  });
  it('should exit 1 on ambiguous match', async () => {
    api.orgs.list.mockResolvedValue({ organizations: [
      { _id: 'org-abc-123', name: 'Team' },
      { _id: 'org-abc-456', name: 'Team' },
    ]});
    await expect(switchOrg('Team')).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith(expect.stringContaining('Multiple'));
  });
  it('should exit 1 when org not found', async () => {
    api.orgs.list.mockResolvedValue({ organizations: [{ _id: 'org-1', name: 'Test' }] });
    await expect(switchOrg('nonexistent')).rejects.toThrow('process.exit called');
    expect(output.outputError).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
  });
  it('should exit 1 on API error', async () => {
    api.orgs.list.mockRejectedValue(new Error('Network error'));
    await expect(switchOrg('test')).rejects.toThrow('process.exit called');
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
