const axios = require('axios');
const chalk = require('chalk');
const { getApiUrl, getToken, clearAuth } = require('./config');

/**
 * API Client for Controlinfra
 * Handles all HTTP requests to the backend
 */

// Create axios instance
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

        // Handle specific error codes
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

        // Generic error
        const message = data?.error || data?.message || `Request failed with status ${status}`;
        throw new Error(message);
      }

      // Network error
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

// ─────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────
const auth = {
  async getMe() {
    const { data } = await getClient().get('/api/auth/me');
    return data;
  },

  async logout() {
    const { data } = await getClient().post('/api/auth/logout');
    return data;
  },

  async refreshToken() {
    const { data } = await getClient().post('/api/auth/refresh');
    return data;
  },

  async getQuota() {
    const { data } = await getClient().get('/api/auth/quota');
    return data;
  },
};

// ─────────────────────────────────────────────────────────
// Repository API
// ─────────────────────────────────────────────────────────
const repos = {
  async list(params = {}) {
    const { data } = await getClient().get('/api/repo-configs', { params });
    return data;
  },

  async get(id) {
    const { data } = await getClient().get(`/api/repo-configs/${id}`);
    return data;
  },

  async create(repoData) {
    const { data } = await getClient().post('/api/repo-configs', repoData);
    return data;
  },

  async update(id, updates) {
    const { data } = await getClient().put(`/api/repo-configs/${id}`, updates);
    return data;
  },

  async delete(id) {
    const { data } = await getClient().delete(`/api/repo-configs/${id}`);
    return data;
  },

  async getStats(id) {
    const { data } = await getClient().get(`/api/repo-configs/${id}/stats`);
    return data;
  },

  async listAvailable(params = {}) {
    const { data } = await getClient().get('/api/repositories', { params });
    return data;
  },
};

// ─────────────────────────────────────────────────────────
// Scan API
// ─────────────────────────────────────────────────────────
const scans = {
  async list(params = {}) {
    const { data } = await getClient().get('/api/scans', { params });
    return data;
  },

  async get(scanId) {
    const { data } = await getClient().get(`/api/scans/${scanId}`);
    return data;
  },

  async getDetails(scanId) {
    const { data } = await getClient().get(`/api/scans/${scanId}/details`);
    return data;
  },

  async trigger(repositoryConfigId, options = {}) {
    const { data } = await getClient().post(`/api/scans/trigger/${repositoryConfigId}`, options);
    return data;
  },

  async cancel(scanId) {
    const { data } = await getClient().post(`/api/scans/${scanId}/cancel`);
    return data;
  },

  async delete(scanId) {
    const { data } = await getClient().delete(`/api/scans/${scanId}`);
    return data;
  },

  async getByRepository(repositoryConfigId, params = {}) {
    const { data } = await getClient().get(`/api/scans/repository/${repositoryConfigId}`, { params });
    return data;
  },

  async getLatest(repositoryConfigId) {
    const { data } = await getClient().get(`/api/scans/repository/${repositoryConfigId}/latest`);
    return data;
  },

  async getDashboard() {
    const { data } = await getClient().get('/api/scans/dashboard');
    return data;
  },
};

// ─────────────────────────────────────────────────────────
// Drift API
// ─────────────────────────────────────────────────────────
const drifts = {
  async list(params = {}) {
    const { data } = await getClient().get('/api/drifts', { params });
    return data;
  },

  async get(driftId) {
    const { data } = await getClient().get(`/api/drifts/${driftId}`);
    return data;
  },

  async getByScan(scanId) {
    const { data } = await getClient().get(`/api/drifts/scan/${scanId}`);
    return data;
  },

  async getByRepository(repositoryConfigId) {
    const { data } = await getClient().get(`/api/drifts/repository/${repositoryConfigId}`);
    return data;
  },

  async getStatistics(repositoryConfigId) {
    const { data } = await getClient().get(`/api/drifts/repository/${repositoryConfigId}/statistics`);
    return data;
  },

  async updateStatus(driftId, status) {
    const { data } = await getClient().patch(`/api/drifts/${driftId}/status`, { status });
    return data;
  },

  async generateFix(driftId, options = {}) {
    const { data } = await getClient().post(`/api/drifts/${driftId}/generate-fix`, options);
    return data;
  },

  async createPR(driftId, options = {}) {
    const { data } = await getClient().post(`/api/drifts/${driftId}/create-pr`, options);
    return data;
  },

  async reanalyze(driftId) {
    const { data } = await getClient().post(`/api/drifts/${driftId}/reanalyze`);
    return data;
  },
};

// ─────────────────────────────────────────────────────────
// Runner API
// ─────────────────────────────────────────────────────────
const runners = {
  async list() {
    const { data } = await getClient().get('/api/runners');
    return data;
  },

  async get(runnerId) {
    const { data } = await getClient().get(`/api/runners/${runnerId}`);
    return data;
  },

  async create(runnerData) {
    const { data } = await getClient().post('/api/runners', runnerData);
    return data;
  },

  async update(runnerId, updates) {
    const { data } = await getClient().put(`/api/runners/${runnerId}`, updates);
    return data;
  },

  async delete(runnerId) {
    const { data } = await getClient().delete(`/api/runners/${runnerId}`);
    return data;
  },

  async regenerateToken(runnerId) {
    const { data } = await getClient().post(`/api/runners/${runnerId}/regenerate-token`);
    return data;
  },

  async getSetup(runnerId) {
    const { data } = await getClient().get(`/api/runners/${runnerId}/setup-info`);
    return data;
  },

  async markOffline(runnerId) {
    const { data } = await getClient().post(`/api/runners/${runnerId}/mark-offline`);
    return data;
  },
};

// ─────────────────────────────────────────────────────────
// Workspace API
// ─────────────────────────────────────────────────────────
const workspaces = {
  async list() {
    const { data } = await getClient().get('/api/workspaces');
    return data;
  },

  async get(workspaceId) {
    const { data } = await getClient().get(`/api/workspaces/${workspaceId}`);
    return data;
  },

  async create(workspaceData) {
    const { data } = await getClient().post('/api/workspaces', workspaceData);
    return data;
  },

  async update(workspaceId, updates) {
    const { data } = await getClient().put(`/api/workspaces/${workspaceId}`, updates);
    return data;
  },

  async delete(workspaceId) {
    const { data } = await getClient().delete(`/api/workspaces/${workspaceId}`);
    return data;
  },

  async setDefault(workspaceId) {
    const { data } = await getClient().put(`/api/workspaces/${workspaceId}/default`);
    return data;
  },
};

// ─────────────────────────────────────────────────────────
// Integration APIs (Slack, AWS, AI)
// ─────────────────────────────────────────────────────────
const integrations = {
  // Slack
  async getSlack() {
    const { data } = await getClient().get('/api/auth/slack');
    return data;
  },

  async updateSlack(settings) {
    const { data } = await getClient().put('/api/auth/slack', settings);
    return data;
  },

  async testSlack() {
    const { data } = await getClient().post('/api/auth/slack/test');
    return data;
  },

  async deleteSlack() {
    const { data } = await getClient().delete('/api/auth/slack');
    return data;
  },

  // AWS
  async getAwsCredentials() {
    const { data } = await getClient().get('/api/auth/aws-credentials');
    return data;
  },

  async saveAwsCredentials(credentials) {
    const { data } = await getClient().post('/api/auth/aws-credentials', credentials);
    return data;
  },

  async deleteAwsCredentials() {
    const { data } = await getClient().delete('/api/auth/aws-credentials');
    return data;
  },

  // Azure
  async getAzureCredentials() {
    const { data } = await getClient().get('/api/auth/azure-credentials');
    return data;
  },

  async saveAzureCredentials(credentials) {
    const { data } = await getClient().post('/api/auth/azure-credentials', credentials);
    return data;
  },

  async deleteAzureCredentials() {
    const { data } = await getClient().delete('/api/auth/azure-credentials');
    return data;
  },

  // GCP
  async getGcpCredentials() {
    const { data } = await getClient().get('/api/auth/gcp-credentials');
    return data;
  },

  async getGcpCredentialsFull() {
    const { data } = await getClient().get('/api/auth/gcp-credentials/full');
    return data;
  },

  async saveGcpCredentials(credentials) {
    const { data } = await getClient().post('/api/auth/gcp-credentials', credentials);
    return data;
  },

  async deleteGcpCredentials() {
    const { data } = await getClient().delete('/api/auth/gcp-credentials');
    return data;
  },

  // AI Provider
  async getAiProvider() {
    const { data } = await getClient().get('/api/auth/ai-provider');
    return data;
  },

  async updateAiProvider(settings) {
    const { data } = await getClient().put('/api/auth/ai-provider', settings);
    return data;
  },

  async saveAnthropicKey(apiKey) {
    const { data } = await getClient().post('/api/auth/anthropic-api-key', { apiKey });
    return data;
  },

  async verifyAnthropicKey(apiKey) {
    const { data } = await getClient().post('/api/auth/anthropic-api-key/verify', { apiKey });
    return data;
  },

  async deleteAnthropicKey() {
    const { data } = await getClient().delete('/api/auth/anthropic-api-key');
    return data;
  },

  async saveOpenaiKey(apiKey) {
    const { data } = await getClient().post('/api/auth/openai-api-key', { apiKey });
    return data;
  },

  async verifyOpenaiKey(apiKey) {
    const { data } = await getClient().post('/api/auth/openai-api-key/verify', { apiKey });
    return data;
  },

  async deleteOpenaiKey() {
    const { data } = await getClient().delete('/api/auth/openai-api-key');
    return data;
  },
};

module.exports = {
  auth,
  repos,
  scans,
  drifts,
  runners,
  workspaces,
  integrations,
  getClient,
};
