'use strict';

const { execSync } = require('child_process');
const path = require('path');

const INSTALL_SCRIPT = path.join(__dirname, '../../scripts/install.sh');

// Skip these tests on Windows — the install script is bash-only
const describeUnix = process.platform === 'win32' ? describe.skip : describe;

/**
 * Helper to run a bash snippet that sources the install script functions
 * and then executes the given command.
 */
function runBashFunction(code) {
  // Source only the functions (not main) by extracting them
  const fullScript = `
    set -e
    # Stub out echo -e to plain echo for test parsing
    # Source the functions by evaluating everything except the final 'main' call
    eval "$(sed '/^main$/d' "${INSTALL_SCRIPT}")"
    ${code}
  `;
  return execSync(`bash -c '${fullScript.replace(/'/g, "'\\''")}'`, {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, TERM: 'dumb' },
  });
}

describeUnix('install.sh - detect_platform', () => {
  it('should detect platform without error', () => {
    const output = runBashFunction('detect_platform && echo "OS=$OS ARCH=$ARCH"');
    expect(output).toMatch(/OS=(linux|macos)/);
    expect(output).toMatch(/ARCH=(x64|arm64)/);
  });

  it('should set PLATFORM variable', () => {
    const output = runBashFunction('detect_platform && echo "PLATFORM=$PLATFORM"');
    expect(output).toMatch(/PLATFORM=(linux|macos|linux-arm64|macos-arm64)/);
  });
});

describeUnix('install.sh - download_binary', () => {
  it('should fail when VERSION is empty and URL is invalid', () => {
    expect(() => {
      runBashFunction('VERSION="" PLATFORM="linux" REPO="controlinfra/cli" download_binary');
    }).toThrow();
  });

  it('should fail on a non-existent release URL', () => {
    expect(() => {
      runBashFunction(
        'VERSION="v0.0.0-nonexistent" PLATFORM="linux" REPO="controlinfra/cli" download_binary',
      );
    }).toThrow();
  });
});
