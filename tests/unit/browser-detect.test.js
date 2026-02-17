'use strict';

const { execSync } = require('child_process');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Must require after mocking
const { canOpenBrowser } = require('../../src/utils/browser-detect');

describe('canOpenBrowser', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('should return true on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    expect(canOpenBrowser()).toBe(true);
  });

  it('should return true on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(canOpenBrowser()).toBe(true);
  });

  it('should return false on linux without DISPLAY or WAYLAND_DISPLAY', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.DISPLAY;
    delete process.env.WAYLAND_DISPLAY;

    expect(canOpenBrowser()).toBe(false);
  });

  it('should return true on linux with DISPLAY and opener found', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.DISPLAY = ':0';
    delete process.env.WAYLAND_DISPLAY;
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.XDG_CURRENT_DESKTOP = 'GNOME';

    execSync.mockImplementation(() => ''); // which succeeds

    expect(canOpenBrowser()).toBe(true);
    expect(execSync).toHaveBeenCalledWith('which xdg-open', { stdio: 'ignore' });
  });

  it('should return true on linux with WAYLAND_DISPLAY and opener found', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.DISPLAY;
    process.env.WAYLAND_DISPLAY = 'wayland-0';
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.XDG_CURRENT_DESKTOP = 'sway';

    execSync.mockImplementation(() => '');

    expect(canOpenBrowser()).toBe(true);
  });

  it('should return false on SSH without a desktop session (headless VM)', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.DISPLAY = 'localhost:10.0'; // X11 forwarding sets DISPLAY
    delete process.env.WAYLAND_DISPLAY;
    process.env.SSH_CONNECTION = '10.0.0.1 12345 10.0.0.2 22';
    process.env.SSH_TTY = '/dev/pts/0';
    delete process.env.XDG_CURRENT_DESKTOP;
    delete process.env.DESKTOP_SESSION;

    expect(canOpenBrowser()).toBe(false);
  });

  it('should return true on SSH with a desktop session', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.DISPLAY = ':0';
    delete process.env.WAYLAND_DISPLAY;
    process.env.SSH_CONNECTION = '10.0.0.1 12345 10.0.0.2 22';
    process.env.XDG_CURRENT_DESKTOP = 'GNOME';

    execSync.mockImplementation(() => '');

    expect(canOpenBrowser()).toBe(true);
  });

  it('should return false on linux with DISPLAY but no opener found', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.DISPLAY = ':0';
    delete process.env.WAYLAND_DISPLAY;
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.XDG_CURRENT_DESKTOP = 'GNOME';

    execSync.mockImplementation(() => {
      throw new Error('not found');
    });

    expect(canOpenBrowser()).toBe(false);
  });

  it('should try multiple openers before giving up', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.DISPLAY = ':0';
    delete process.env.WAYLAND_DISPLAY;
    delete process.env.SSH_CONNECTION;
    delete process.env.SSH_TTY;
    process.env.XDG_CURRENT_DESKTOP = 'GNOME';

    // Fail first two, succeed on third
    execSync
      .mockImplementationOnce(() => { throw new Error('not found'); })
      .mockImplementationOnce(() => { throw new Error('not found'); })
      .mockImplementationOnce(() => '');

    expect(canOpenBrowser()).toBe(true);
    expect(execSync).toHaveBeenCalledTimes(3);
    expect(execSync).toHaveBeenCalledWith('which sensible-browser', { stdio: 'ignore' });
  });
});
