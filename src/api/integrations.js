const { getClient } = require('./client');

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

module.exports = integrations;
