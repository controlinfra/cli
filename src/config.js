const Conf = require('conf');
const chalk = require('chalk');

/**
 * Configuration storage for Controlinfra CLI
 * Stores credentials and settings in ~/.config/controlinfra-nodejs/config.json
 */

const config = new Conf({
  projectName: 'controlinfra',
  schema: {
    apiUrl: {
      type: 'string',
      default: 'https://api.controlinfra.com',
    },
    token: {
      type: 'string',
    },
    refreshToken: {
      type: 'string',
    },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        displayName: { type: 'string' },
        avatar: { type: 'string' },
        role: { type: 'string' },
        defaultOrgId: { type: 'string' },
      },
    },
    defaultWorkspace: {
      type: 'string',
    },
    orgId: {
      type: 'string',
    },
    outputFormat: {
      type: 'string',
      enum: ['table', 'json', 'yaml'],
      default: 'table',
    },
  },
});

/**
 * Get the API base URL
 */
function getApiUrl() {
  if (process.env.CONTROLINFRA_API_URL) return process.env.CONTROLINFRA_API_URL;

  const stored = config.get('apiUrl');
  // Migrate stale default: www.controlinfra.com is the marketing site, not the API
  if (stored === 'https://www.controlinfra.com') {
    config.set('apiUrl', 'https://api.controlinfra.com');
    return 'https://api.controlinfra.com';
  }
  return stored;
}

/**
 * Get the authentication token
 */
function getToken() {
  return process.env.CONTROLINFRA_TOKEN || config.get('token');
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getToken();
}

/**
 * Save authentication credentials.
 *
 * `orgId` is seeded from `user.defaultOrgId` ONLY when no orgId is
 * currently set (fresh machine, or just after `clearAuth`). On every
 * subsequent saveAuth — most importantly the one inside
 * src/commands/auth.js's `whoami`, which is called on every invocation
 * to refresh the cached user — the existing orgId is preserved so a
 * prior `controlinfra orgs switch` or `controlinfra config set orgId`
 * is NOT silently reverted to the user's default.
 *
 * For the original "fresh login from a clean machine inherits a stale
 * orgId from a previous account" failure mode, see `clearAuth` below —
 * it now deletes `orgId` so post-logout re-login starts with a clean
 * slate and the seed branch here runs.
 */
function saveAuth({ token, refreshToken, user }) {
  if (token) config.set('token', token);
  if (refreshToken) config.set('refreshToken', refreshToken);
  if (user) {
    config.set('user', user);
    if (user.defaultOrgId && !config.get('orgId')) {
      config.set('orgId', user.defaultOrgId);
    }
  }
}

/**
 * Clear authentication credentials.
 *
 * Also clears `orgId` so a subsequent login re-seeds it from the new
 * user's `defaultOrgId`. Without this, the stale orgId from a previous
 * user persists past logout and saveAuth's "only seed when missing"
 * rule would skip re-seeding — leaving the next user pointing at an
 * org they may not have access to.
 */
function clearAuth() {
  config.delete('token');
  config.delete('refreshToken');
  config.delete('user');
  config.delete('orgId');
}

/**
 * Get stored user info
 */
function getUser() {
  return config.get('user');
}

/**
 * Require authentication or exit
 */
function requireAuth() {
  if (!isAuthenticated()) {
    console.error(chalk.red('\nError: Not authenticated'));
    console.log(chalk.dim('Run'), chalk.yellow('controlinfra login'), chalk.dim('to authenticate\n'));
    process.exit(1);
  }
}

/**
 * Get output format from options
 */
function getOutputFormat(options) {
  if (options?.json || options?.parent?.opts()?.json) return 'json';
  return config.get('outputFormat') || 'table';
}

/**
 * Check if quiet mode
 */
function isQuiet(options) {
  return options?.quiet || options?.parent?.opts()?.quiet;
}

/**
 * Set default workspace
 */
function setDefaultWorkspace(workspaceId) {
  config.set('defaultWorkspace', workspaceId);
}

/**
 * Get default workspace
 */
function getDefaultWorkspace() {
  return config.get('defaultWorkspace');
}

/**
 * Set custom API URL (for self-hosted)
 */
function setApiUrl(url) {
  config.set('apiUrl', url);
}

/**
 * Reset all configuration
 */
function reset() {
  config.clear();
}

/**
 * Get config file path (for debugging)
 */
function getConfigPath() {
  return config.path;
}

/**
 * Get drift gate options from environment variables
 * Used for CI/CD pipeline defaults
 */
function getDriftGateDefaults() {
  return {
    failOnDrift: process.env.CONTROLINFRA_FAIL_ON_DRIFT === 'true',
    failOnSeverity: process.env.CONTROLINFRA_FAIL_ON_SEVERITY || null,
    failOnNewOnly: process.env.CONTROLINFRA_FAIL_ON_NEW_ONLY === 'true',
  };
}

module.exports = {
  config,
  getApiUrl,
  getToken,
  isAuthenticated,
  saveAuth,
  clearAuth,
  getUser,
  requireAuth,
  getOutputFormat,
  isQuiet,
  setDefaultWorkspace,
  getDefaultWorkspace,
  setApiUrl,
  reset,
  getConfigPath,
  getDriftGateDefaults,
};
