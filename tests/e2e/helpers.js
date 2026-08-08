/**
 * E2E Test Helpers
 * Utilities for running CLI commands and making API calls
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM has no __dirname; Vitest injects one but plain `node` does not, so
// derive it rather than depend on the runner.
const HERE = path.dirname(fileURLToPath(import.meta.url));
import axios from 'axios';

const CLI_PATH = path.join(HERE, '../../bin/controlinfra.js');
const API_URL = process.env.CONTROLINFRA_API_URL || 'https://api-stage.controlinfra.com';
const TEST_TOKEN = process.env.CONTROLINFRA_TEST_TOKEN;

/**
 * Run a CLI command and return the output
 * @param {string} args - Command arguments (e.g., 'repos list')
 * @param {object} options - Options { env, timeout, expectError }
 * @returns {object} { stdout, stderr, exitCode }
 */
function runCLI(args, options = {}) {
  const env = {
    ...process.env,
    CONTROLINFRA_API_URL: API_URL,
    CONTROLINFRA_TOKEN: TEST_TOKEN,
    NO_COLOR: '1', // Disable colors for easier parsing
    ...options.env,
  };

  // Use spawnSync so we capture BOTH stdout and stderr regardless of
  // exit code. execSync only returned stdout on success and lost the
  // ora spinner messages (which go to stderr) — so assertions on
  // `spinner.succeed("Project updated")` saw an empty stdout and
  // failed in CI. Tests now assert against the combined output.
  const tokens = String(args).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const cleanedArgs = tokens.map((t) => (t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t));
  const result = spawnSync('node', [CLI_PATH, ...cleanedArgs], {
    encoding: 'utf8',
    timeout: options.timeout || 30000,
    env,
    shell: false,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || (result.error ? result.error.message : '');
  const exitCode = result.status == null ? 1 : result.status;

  if (exitCode !== 0 && !options.expectError) {
    const err = new Error(`CLI exited with code ${exitCode}: ${stderr || stdout}`);
    err.stdout = stdout;
    err.stderr = stderr;
    err.status = exitCode;
    throw err;
  }
  return { stdout, stderr, exitCode };
}

/**
 * Make a direct API call to the stage server
 * @param {string} method - HTTP method
 * @param {string} endpoint - API endpoint (e.g., '/api/repos')
 * @param {object} data - Request body
 * @returns {Promise<object>} API response
 */
async function apiCall(method, endpoint, data = null) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (TEST_TOKEN) {
    headers['Authorization'] = `Bearer ${TEST_TOKEN}`;
  }
  // Most org-scoped endpoints (/api/repo-configs, /api/runners, /api/scans,
  // /api/workspaces, /api/projects) require X-Org-Id to resolve the active
  // organization. The CLI client sends this header automatically; we have to
  // do it manually for direct API calls in tests. Pull from env so the
  // GitHub Actions workflow can inject a known test org.
  if (process.env.CONTROLINFRA_TEST_ORG_ID) {
    headers['X-Org-Id'] = process.env.CONTROLINFRA_TEST_ORG_ID;
  }

  try {
    const response = await axios({
      method,
      url,
      data,
      headers,
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      return { error: error.response.data, status: error.response.status };
    }
    throw error;
  }
}

/**
 * Check if the stage server is reachable
 */
async function isServerReachable() {
  try {
    await axios.get(`${API_URL}/api/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    // Try without /health endpoint
    try {
      await axios.get(API_URL, { timeout: 5000 });
      return true;
    } catch (e) {
      return false;
    }
  }
}

/**
 * Skip test if server is not reachable
 */
async function skipIfServerUnreachable() {
  const reachable = await isServerReachable();
  if (!reachable) {
    console.warn(`⚠️  Stage server ${API_URL} is not reachable. Skipping E2E tests.`);
    return true;
  }
  return false;
}

/**
 * Skip test if no token is configured
 */
function skipIfNoToken() {
  if (!TEST_TOKEN) {
    console.warn('⚠️  CONTROLINFRA_TEST_TOKEN not set. Skipping authenticated tests.');
    return true;
  }
  return false;
}

/**
 * Check if the token is expired by decoding JWT.
 * CLI API tokens (ci_ prefix) don't expire — only JWTs can.
 */
function isTokenExpired() {
  if (!TEST_TOKEN) return true;

  // CLI API tokens (e.g. ci_abc123...) don't have an expiry
  if (!TEST_TOKEN.includes('.')) return false;

  try {
    const parts = TEST_TOKEN.split('.');
    if (parts.length !== 3) return false; // Malformed JWT, let server validate

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (!payload.exp) return false; // No expiry means it doesn't expire

    // Check if expired (with 60 second buffer)
    return Date.now() >= (payload.exp * 1000) - 60000;
  } catch (e) {
    return false; // Can't decode — assume valid, let the server reject if bad
  }
}

/**
 * Check if token is valid (exists and not expired)
 */
function skipIfTokenInvalid() {
  if (!TEST_TOKEN) {
    console.warn('⚠️  CONTROLINFRA_TEST_TOKEN not set. Skipping authenticated tests.');
    return true;
  }

  if (isTokenExpired()) {
    console.warn('⚠️  CONTROLINFRA_TEST_TOKEN is expired. Skipping authenticated tests.');
    return true;
  }

  return false;
}

/**
 * Wrapper around it() that uses it.skip when no valid token is available.
 * This ensures CI reports skipped (not silently passed) tests.
 */
function itAuthenticated(name, fn) {
  if (!TEST_TOKEN || isTokenExpired()) {
    it.skip(name, fn);
  } else {
    it(name, fn);
  }
}

export {
  runCLI,
  apiCall,
  isServerReachable,
  skipIfServerUnreachable,
  skipIfNoToken,
  skipIfTokenInvalid,
  isTokenExpired,
  itAuthenticated,
  CLI_PATH,
  API_URL,
  TEST_TOKEN,
};
