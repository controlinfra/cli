'use strict';

const { execSync } = require('child_process');

/**
 * Heuristically detect if a browser can be opened on this machine.
 * On Linux, requires DISPLAY/WAYLAND_DISPLAY and a URL opener binary.
 * SSH sessions without XDG_CURRENT_DESKTOP/DESKTOP_SESSION are treated
 * as headless (e.g. EC2) and return false even if xdg-open exists.
 */
function canOpenBrowser() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return true;
  }

  // Linux: need a display server
  const hasDisplay = !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  if (!hasDisplay) {
    return false;
  }

  // SSH session without a desktop session is almost certainly headless.
  // XDG_CURRENT_DESKTOP / DESKTOP_SESSION are set by real desktop environments.
  const isSSH = !!(process.env.SSH_CONNECTION || process.env.SSH_TTY);
  const hasDesktop = !!(process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION);
  if (isSSH && !hasDesktop) {
    return false;
  }

  // Verify a URL opener binary exists
  const openers = ['xdg-open', 'x-www-browser', 'sensible-browser', 'gnome-open', 'kde-open'];
  for (const cmd of openers) {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

module.exports = { canOpenBrowser };
