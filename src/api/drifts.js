const { getClient } = require('./client');

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

  async exportDrifts(params = {}) {
    const { data } = await getClient().get('/api/drifts/export', { params });
    return data;
  },
};

module.exports = drifts;
