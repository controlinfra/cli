const { getClient } = require('./client');

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

module.exports = repos;
