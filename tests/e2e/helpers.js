/**
 * E2E Test Helpers
 * Utilities for running CLI commands and making API calls
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

const CLI_PATH = path.join(__dirname, '../../bin/controlinfra.js');
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

  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf8',
      timeout: options.timeout || 30000,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    if (options.expectError) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1,
      };
    }
    throw error;
  }
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

module.exports = {
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
