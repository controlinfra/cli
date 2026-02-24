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

  // Add auth token to requests
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle response errors
  client.interceptors.response.use(
    (response) => response,
    (error) => {
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
