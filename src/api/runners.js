const { getClient } = require('./client');

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

module.exports = runners;
