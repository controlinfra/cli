'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const { getDriftGateDefaults } = require('../../src/config');

describe('getDriftGateDefaults', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear drift gate env vars
    delete process.env.CONTROLINFRA_FAIL_ON_DRIFT;
    delete process.env.CONTROLINFRA_FAIL_ON_SEVERITY;
    delete process.env.CONTROLINFRA_FAIL_ON_NEW_ONLY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default values when no environment variables are set', () => {
    const defaults = getDriftGateDefaults();

    expect(defaults).toEqual({
      failOnDrift: false,
      failOnSeverity: null,
      failOnNewOnly: false,
    });
  });

  it('should return failOnDrift true when CONTROLINFRA_FAIL_ON_DRIFT is "true"', () => {
    process.env.CONTROLINFRA_FAIL_ON_DRIFT = 'true';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnDrift).toBe(true);
  });

  it('should return failOnDrift false when CONTROLINFRA_FAIL_ON_DRIFT is not "true"', () => {
    process.env.CONTROLINFRA_FAIL_ON_DRIFT = 'false';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnDrift).toBe(false);
  });

  it('should return failOnDrift false when CONTROLINFRA_FAIL_ON_DRIFT is "1"', () => {
    // Only exact string "true" should enable the flag
    process.env.CONTROLINFRA_FAIL_ON_DRIFT = '1';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnDrift).toBe(false);
  });

  it('should return failOnSeverity value when CONTROLINFRA_FAIL_ON_SEVERITY is set', () => {
    process.env.CONTROLINFRA_FAIL_ON_SEVERITY = 'high';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnSeverity).toBe('high');
  });

  it('should return failOnSeverity null when CONTROLINFRA_FAIL_ON_SEVERITY is empty', () => {
    process.env.CONTROLINFRA_FAIL_ON_SEVERITY = '';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnSeverity).toBe(null);
  });

  it('should accept all severity levels', () => {
    const levels = ['critical', 'high', 'medium', 'low'];

    levels.forEach((level) => {
      process.env.CONTROLINFRA_FAIL_ON_SEVERITY = level;
      const defaults = getDriftGateDefaults();
      expect(defaults.failOnSeverity).toBe(level);
    });
  });

  it('should return failOnNewOnly true when CONTROLINFRA_FAIL_ON_NEW_ONLY is "true"', () => {
    process.env.CONTROLINFRA_FAIL_ON_NEW_ONLY = 'true';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnNewOnly).toBe(true);
  });

  it('should return failOnNewOnly false when CONTROLINFRA_FAIL_ON_NEW_ONLY is not "true"', () => {
    process.env.CONTROLINFRA_FAIL_ON_NEW_ONLY = 'yes';

    const defaults = getDriftGateDefaults();

    expect(defaults.failOnNewOnly).toBe(false);
  });

  it('should handle all environment variables set together', () => {
    process.env.CONTROLINFRA_FAIL_ON_DRIFT = 'true';
    process.env.CONTROLINFRA_FAIL_ON_SEVERITY = 'critical';
    process.env.CONTROLINFRA_FAIL_ON_NEW_ONLY = 'true';

    const defaults = getDriftGateDefaults();

    expect(defaults).toEqual({
      failOnDrift: true,
      failOnSeverity: 'critical',
      failOnNewOnly: true,
    });
  });
});

describe('getApiUrl', () => {
  const originalEnv = process.env;
  let tmpDir;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CONTROLINFRA_API_URL;
    // Use a temp directory so tests don't touch the real config
    tmpDir = path.join(os.tmpdir(), `ci-config-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = tmpDir;
    process.env.APPDATA = tmpDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up temp config
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should return env var when CONTROLINFRA_API_URL is set', () => {
    process.env.CONTROLINFRA_API_URL = 'https://custom.example.com';
    const { getApiUrl } = require('../../src/config');

    expect(getApiUrl()).toBe('https://custom.example.com');
  });

  it('should return default api.controlinfra.com for fresh installs', () => {
    const { getApiUrl } = require('../../src/config');

    expect(getApiUrl()).toBe('https://api.controlinfra.com');
  });

  it('should migrate stale www.controlinfra.com to api.controlinfra.com', () => {
    // Simulate a config file with the old default
    const { config, getApiUrl } = require('../../src/config');
    config.set('apiUrl', 'https://www.controlinfra.com');

    const url = getApiUrl();

    expect(url).toBe('https://api.controlinfra.com');
    // Verify it was persisted
    expect(config.get('apiUrl')).toBe('https://api.controlinfra.com');
  });

  it('should not migrate a custom API URL', () => {
    const { config, getApiUrl } = require('../../src/config');
    config.set('apiUrl', 'https://self-hosted.example.com');

    expect(getApiUrl()).toBe('https://self-hosted.example.com');
  });

  it('should prefer env var over stored config (no migration applied)', () => {
    process.env.CONTROLINFRA_API_URL = 'https://override.example.com';
    const { config, getApiUrl } = require('../../src/config');
    config.set('apiUrl', 'https://www.controlinfra.com');

    expect(getApiUrl()).toBe('https://override.example.com');
    // Stale value should NOT be migrated when env var takes precedence
    expect(config.get('apiUrl')).toBe('https://www.controlinfra.com');
  });
});
