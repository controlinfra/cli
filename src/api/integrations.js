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
    // Server returns { success, settings: { defaultProvider,
    // hasAnthropicKey, hasOpenAIKey } } but CLI commands read
    // data.provider / data.hasCustomKey. Normalize at the API
    // boundary so command files stay readable; without this
    // normalization, `ai status` always shows "default / No" even
    // when an API key is saved.
    if (data?.settings) {
      const s = data.settings;
      const hasCustomKey = !!(s.hasAnthropicKey || s.hasOpenAIKey);
      return {
        provider: s.defaultProvider,
        hasCustomKey,
        hasAnthropicKey: !!s.hasAnthropicKey,
        hasOpenAIKey: !!s.hasOpenAIKey,
      };
    }
    return data;
  },

  async updateAiProvider(settings) {
    // CLI commands call this as `updateAiProvider({ provider: 'anthropic' })`
    // but the server's PUT /api/auth/ai-provider reads `defaultProvider`.
    // Rename at the boundary and DROP the legacy `provider` key so we
    // don't double-send (which can trip strict-mode unknown-field
    // validators server-side). Other future keys in `settings` pass
    // through unchanged.
    const { provider, ...rest } = settings || {};
    const payload = provider && !rest.defaultProvider
      ? { ...rest, defaultProvider: provider }
      : rest;
    const { data } = await getClient().put('/api/auth/ai-provider', payload);
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
