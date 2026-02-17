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
      default: 'https://www.controlinfra.com',
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
      },
    },
    defaultWorkspace: {
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
  return process.env.CONTROLINFRA_API_URL || config.get('apiUrl');
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
 * Save authentication credentials
 */
function saveAuth({ token, refreshToken, user }) {
  if (token) config.set('token', token);
  if (refreshToken) config.set('refreshToken', refreshToken);
  if (user) config.set('user', user);
}

/**
 * Clear authentication credentials
 */
function clearAuth() {
  config.delete('token');
  config.delete('refreshToken');
  config.delete('user');
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
