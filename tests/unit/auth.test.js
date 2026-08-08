'use strict';

vi.mock('../../src/api', async (importOriginal) => ({
  ...(await importOriginal()),
  auth: {
    getMe: vi.fn(),
    logout: vi.fn(),
    getQuota: vi.fn(),
  },
  repos: { list: vi.fn() },
  scans: { list: vi.fn() },
  drifts: { list: vi.fn() },
}));

vi.mock('../../src/config', async (importOriginal) => ({
  ...(await importOriginal()),
  saveAuth: vi.fn(),
  clearAuth: vi.fn(),
  getUser: vi.fn(),
  isAuthenticated: vi.fn(),
  getApiUrl: vi.fn(() => 'https://api.controlinfra.com'),
  getConfigPath: vi.fn(() => '/mock/config/path'),
}));

// vi.mock is hoisted above the file body, so anything its factory
// references has to be hoisted too — hence vi.hoisted().
const { mockSpinner } = vi.hoisted(() => ({ mockSpinner: {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
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
  outputInfo: vi.fn(),
  outputBox: vi.fn(),
}));

vi.mock('../../src/banner', () => ({
  gradientBanner: vi.fn(),
}));

vi.mock('../../src/utils/browser-detect', async (importOriginal) => ({
  ...(await importOriginal()),
  canOpenBrowser: vi.fn(),
}));

vi.mock('../../src/commands/auth-html', async (importOriginal) => ({
  ...(await importOriginal()),
  getSuccessHtml: vi.fn(() => '<html>success</html>'),
  getErrorHtml: vi.fn(() => '<html>error</html>'),
}));

vi.mock('child_process', () => {
  const mocked = {
  execFile: vi.fn(),
};
  // source imports this as a default (`import cp from 'child_process'`)
  return { ...mocked, default: mocked };
});

vi.mock('inquirer', () => {
  const prompt = vi.fn();
  // src does `import inquirer from 'inquirer'`, so the mock must expose
  // a default; the named export is kept for tests that reach for it.
  return { default: { prompt }, prompt };
});

import * as api from '../../src/api.js';
import * as config from '../../src/config.js';
import * as output from '../../src/output.js';
import inquirer from 'inquirer';
import childProcess from 'child_process';
import http from 'http';
import { canOpenBrowser } from '../../src/utils/browser-detect.js';
import { login, logout, whoami } from '../../src/commands/auth.js';

// Silence console.log noise from showDashboard, whoami, etc.
beforeAll(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { console.log.mockRestore(); mockExit.mockRestore(); });

// Prevent process.exit from killing the test runner
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.clearAllMocks();
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
    vi.clearAllMocks();
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

describe('login manual token entry - settings URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canOpenBrowser.mockReturnValue(false);
    // Simulate user providing a token via prompt
    inquirer.prompt.mockResolvedValue({ token: 'test-token' });
    api.auth.getMe.mockResolvedValue({ user: { displayName: 'Test' } });
    api.repos.list.mockResolvedValue({ configs: [] });
    api.scans.list.mockResolvedValue({ scans: [] });
    api.drifts.list.mockResolvedValue({ drifts: [] });
  });

  it('should show production settings URL by default', async () => {
    config.getApiUrl.mockReturnValue('https://api.controlinfra.com');
    await login({});
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('https://console.controlinfra.com/settings'),
    );
  });

  it('should show staging settings URL for stage API', async () => {
    config.getApiUrl.mockReturnValue('https://api-stage.controlinfra.com');
    await login({});
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('https://console-stage.controlinfra.com/settings'),
    );
  });

  it('should show localhost settings URL for local dev', async () => {
    config.getApiUrl.mockReturnValue('http://localhost:3000');
    await login({});
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:5173/settings'),
    );
  });
});

describe('browser auth - Windows URL escaping', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (http.createServer.mockRestore) http.createServer.mockRestore();
  });

  it('should escape cmd metacharacters in auth URL on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    canOpenBrowser.mockReturnValue(true);
    config.getApiUrl.mockReturnValue('https://api.controlinfra.com');
    api.auth.getMe.mockResolvedValue({ user: { displayName: 'Test' } });
    api.repos.list.mockResolvedValue({ configs: [] });
    api.scans.list.mockResolvedValue({ scans: [] });
    api.drifts.list.mockResolvedValue({ drifts: [] });

    // Mock HTTP server to simulate OAuth callback
    const requestHandlers = [];
    const mockServer = {
      listen: vi.fn((port, host, cb) => cb()),
      address: vi.fn(() => ({ port: 12345 })),
      on: vi.fn((event, handler) => { if (event === 'request') requestHandlers.push(handler); }),
      close: vi.fn(),
    };
    vi.spyOn(http, 'createServer').mockReturnValue(mockServer);

    const loginPromise = login({});
    await new Promise((r) => setImmediate(r));

    // Simulate OAuth callback with token
    const mockReq = { url: '/callback?token=test-jwt-token' };
    const mockRes = { writeHead: vi.fn(), end: vi.fn() };
    requestHandlers[0](mockReq, mockRes);

    await loginPromise;

    // Verify cmd was called with escaped URL (& becomes ^&)
    expect(childProcess.execFile).toHaveBeenCalledWith(
      'cmd',
      ['/c', 'start', '', expect.stringContaining('^&redirect_uri')],
    );
    const escapedUrl = childProcess.execFile.mock.calls[0][1][3];
    expect(escapedUrl).not.toMatch(/(?<!\^)&/);
  });
});
