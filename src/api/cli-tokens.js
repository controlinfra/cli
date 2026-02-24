const { getClient } = require('./client');

const cliTokens = {
  async list() {
    const { data } = await getClient().get('/api/auth/cli-tokens');
    return data;
  },

  async create(name, options = {}) {
    const { data } = await getClient().post('/api/auth/cli-tokens', { name, ...options });
    return data;
  },

  async revoke(tokenId) {
    const { data } = await getClient().delete(`/api/auth/cli-tokens/${tokenId}`);
    return data;
  },
};

module.exports = cliTokens;
