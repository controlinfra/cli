const { getClient } = require('./client');

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

  async retry(scanId) {
    const { data } = await getClient().post(`/api/scans/${scanId}/retry`);
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

module.exports = scans;
