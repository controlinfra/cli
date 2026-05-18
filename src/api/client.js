const axios = require('axios');
const chalk = require('chalk');
const { getApiUrl, getToken, clearAuth } = require('../config');

/**
 * Create a configured axios instance with auth interceptors
 */
const createClient = () => {
  const client = axios.create({
    baseURL: getApiUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth token and org context to requests
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Send org context so server scopes resources correctly
    const { getUser, config: cliConfig } = require('../config');
    const user = getUser();
    const orgId = process.env.CONTROLINFRA_ORG_ID || cliConfig.get('orgId') || user?.defaultOrgId;
    if (orgId) {
      config.headers['X-Org-Id'] = orgId;
    }
    return config;
  });

  // Handle response errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response) {
        const { status, data } = error.response;

        if (status === 401) {
          clearAuth();
          console.error(chalk.red('\nSession expired. Please login again.'));
          console.log(chalk.dim('Run'), chalk.yellow('controlinfra login'), chalk.dim('to authenticate\n'));
          process.exit(1);
        }

        if (status === 403) {
          console.error(chalk.red('\nAccess denied. You do not have permission for this action.\n'));
          process.exit(1);
        }

        if (status === 404) {
          const message = data?.error || data?.message || 'Resource not found';

          // Stale-orgId self-heal. If the API said the org doesn't
          // exist (deleted org, or a leftover orgId from a previous
          // account in the config file), retry the request ONCE with
          // the logged-in user's defaultOrgId in the header.
          //
          // Deliberately does NOT persist the fallback to disk —
          // a user who intentionally ran `controlinfra orgs switch`
          // to org X (and currently lacks access, or whose request
          // races with a membership change) would otherwise have
          // their selection silently clobbered. The retry covers
          // them for this single request; their persisted choice
          // stays intact so they see the real error on the next
          // call and can react.
          //
          // Single-retry guard (_orgFallbackTried) prevents loops if
          // the fallback also 404s.
          const isOrgMissing = /organization not found/i.test(message);
          if (isOrgMissing && !error.config?._orgFallbackTried) {
            const { getUser, config: cliConfig } = require('../config');
            const user = getUser();
            const fallbackOrgId = user?.defaultOrgId;
            const currentOrgId = cliConfig.get('orgId');
            if (fallbackOrgId && String(fallbackOrgId) !== String(currentOrgId)) {
              console.error(chalk.yellow(`\nWarning: org ${currentOrgId} not found — retrying this request with your default org (${fallbackOrgId}).`));
              console.error(chalk.dim(`To make the switch permanent, run: ${chalk.yellow(`controlinfra orgs switch ${fallbackOrgId}`)}\n`));
              error.config._orgFallbackTried = true;
              error.config.headers = error.config.headers || {};
              error.config.headers['X-Org-Id'] = fallbackOrgId;
              return client.request(error.config);
            }
          }

          throw new Error(message);
        }

        if (status === 429) {
          console.error(chalk.red('\nRate limit exceeded. Please try again later.\n'));
          process.exit(1);
        }

        const message = data?.error || data?.message || `Request failed with status ${status}`;
        throw new Error(message);
      }

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to Controlinfra API. Check your network connection.');
      }

      throw error;
    },
  );

  return client;
};

// Lazy-loaded client
let client = null;
const getClient = () => {
  if (!client) {
    client = createClient();
  }
  return client;
};

module.exports = { createClient, getClient };
