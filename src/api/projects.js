const { getClient } = require('./client');

const projects = {
  async list(params = {}) {
    const { data } = await getClient().get('/api/projects', { params });
    return data;
  },

  async get(projectId) {
    const { data } = await getClient().get(`/api/projects/${projectId}`);
    return data;
  },

  async create(projectData) {
    const { data } = await getClient().post('/api/projects', projectData);
    return data;
  },

  async update(projectId, updates) {
    const { data } = await getClient().put(`/api/projects/${projectId}`, updates);
    return data;
  },

  async delete(projectId) {
    const { data } = await getClient().delete(`/api/projects/${projectId}`);
    return data;
  },

  async setDefault(projectId) {
    const { data } = await getClient().put(`/api/projects/${projectId}/default`);
    return data;
  },
};

module.exports = projects;
