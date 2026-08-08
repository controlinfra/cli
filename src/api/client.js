import axios from 'axios';
import chalk from 'chalk';
import { getApiUrl, getToken, clearAuth, getUser, config as cliConfig } from '../config.js';

// Network/codes that signal a transient failure where the request likely
// never produced a server-side effect (connection reset, timeout, DNS blip).
const TRANSIENT_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'EPIPE'];
// Idempotent methods are safe to replay; we deliberately do NOT retry POST so a
// dropped connection can't silently double-create (e.g. two CLI tokens).
const IDEMPOTENT_METHODS = ['get', 'head', 'options', 'delete'];
const MAX_RETRIES = 2;

// Pure predicate (unit-tested): should this failed request be retried?
function isRetryable(error) {
  const method = (error?.config?.method || 'get').toLowerCase();
  if (!IDEMPOTENT_METHODS.includes(method)) return false;
  if (error?.response) return [502, 503, 504].includes(error.response.status);
  // No response → network-level failure; retry only the known-transient ones.
  return TRANSIENT_CODES.includes(error?.code);
}

const retryDelayMs = (attempt) => 300 * attempt;

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
      // Transient-failure retry (idempotent requests only) with linear
      // backoff. Covers a momentarily busy/redeploying API dropping the
      // connection — without this a single reset fails the whole command.
      if (isRetryable(error)) {
        const cfg = error.config;
        cfg._retryCount = (cfg._retryCount || 0) + 1;
        if (cfg._retryCount <= MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(cfg._retryCount)));
          return client.request(cfg);
        }
      }

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

export { createClient, getClient, isRetryable, retryDelayMs };