'use strict';

jest.mock('../../src/api', () => ({
  auth: {
    getMe: jest.fn(),
    logout: jest.fn(),
    getQuota: jest.fn(),
  },
  repos: { list: jest.fn() },
  scans: { list: jest.fn() },
  drifts: { list: jest.fn() },
}));

jest.mock('../../src/config', () => ({
  saveAuth: jest.fn(),
  clearAuth: jest.fn(),
  getUser: jest.fn(),
  isAuthenticated: jest.fn(),
  getApiUrl: jest.fn(() => 'https://api.controlinfra.com'),
  getConfigPath: jest.fn(() => '/mock/config/path'),
}));

const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
};
jest.mock('../../src/output', () => ({
  createSpinner: jest.fn(() => mockSpinner),
  outputError: jest.fn(),
  outputInfo: jest.fn(),
  outputBox: jest.fn(),
}));

jest.mock('../../src/utils/browser-detect', () => ({
  canOpenBrowser: jest.fn(),
}));

jest.mock('../../src/commands/auth-html', () => ({
  getSuccessHtml: jest.fn(() => '<html>success</html>'),
  getErrorHtml: jest.fn(() => '<html>error</html>'),
}));

const api = require('../../src/api');
const config = require('../../src/config');
const output = require('../../src/output');
const { login, logout, whoami } = require('../../src/commands/auth');

// Silence console.log noise from showDashboard, whoami, etc.
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });

// Prevent process.exit from killing the test runner
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock dashboard API calls to prevent hanging
    api.repos.list.mockResolvedValue({ configs: [] });
    api.scans.list.mockResolvedValue({ scans: [] });
    api.drifts.list.mockResolvedValue({ drifts: [] });
  });

  it('should save token and show dashboard on login --token success', async () => {
    const mockUser = { displayName: 'Test User', email: 'test@example.com' };
    api.auth.getMe.mockResolvedValue({ user: mockUser });

    await login({ token: 'valid-token-123' });

    expect(config.saveAuth).toHaveBeenCalledWith({ token: 'valid-token-123' });
    expect(api.auth.getMe).toHaveBeenCalled();
    expect(config.saveAuth).toHaveBeenCalledWith({ user: mockUser });
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Logged in successfully');
  });

  it('should clear auth and exit on login --token failure', async () => {
    api.auth.getMe.mockRejectedValue(new Error('Invalid token'));

    await expect(login({ token: 'bad-token' })).rejects.toThrow('process.exit called');

    expect(config.saveAuth).toHaveBeenCalledWith({ token: 'bad-token' });
    expect(config.clearAuth).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

describe('logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should clear auth when authenticated', async () => {
    config.isAuthenticated.mockReturnValue(true);
    config.getUser.mockReturnValue({ displayName: 'Test User' });
    api.auth.logout.mockResolvedValue({});

    await logout();

    expect(config.clearAuth).toHaveBeenCalled();
    expect(mockSpinner.succeed).toHaveBeenCalledWith('Logged out successfully');
  });

  it('should show info when not authenticated', async () => {
    config.isAuthenticated.mockReturnValue(false);

    await logout();

    expect(output.outputInfo).toHaveBeenCalledWith('Not currently logged in');
    expect(config.clearAuth).not.toHaveBeenCalled();
  });

  it('should still clear auth if server logout fails', async () => {
    config.isAuthenticated.mockReturnValue(true);
    config.getUser.mockReturnValue(null);
    api.auth.logout.mockRejectedValue(new Error('Network error'));

    await logout();

    expect(config.clearAuth).toHaveBeenCalled();
  });
});

describe('whoami', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show login prompt when not authenticated', async () => {
    config.isAuthenticated.mockReturnValue(false);

    await whoami();

    expect(api.auth.getMe).not.toHaveBeenCalled();
  });

  it('should display user info when authenticated', async () => {
    config.isAuthenticated.mockReturnValue(true);
    const mockUser = {
      displayName: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      githubUsername: 'testuser',
    };
    api.auth.getMe.mockResolvedValue({ user: mockUser });
    api.auth.getQuota.mockRejectedValue(new Error('not available'));

    await whoami();

    expect(config.saveAuth).toHaveBeenCalledWith({ user: mockUser });
    expect(output.outputBox).toHaveBeenCalled();
  });

  it('should handle getMe failure gracefully', async () => {
    config.isAuthenticated.mockReturnValue(true);
    api.auth.getMe.mockRejectedValue(new Error('Token expired'));

    await whoami();

    expect(output.outputError).toHaveBeenCalledWith('Token expired');
  });
});
