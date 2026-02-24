const { getClient } = require('./client');

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

  async getAccess(workspaceId) {
    const { data } = await getClient().get(`/api/workspaces/${workspaceId}/access`);
    return data;
  },

  async addAccess(workspaceId, userId, role) {
    const { data } = await getClient().post(`/api/workspaces/${workspaceId}/access`, { userId, role });
    return data;
  },

  async removeAccess(workspaceId, userId) {
    const { data } = await getClient().delete(`/api/workspaces/${workspaceId}/access/${userId}`);
    return data;
  },

  async setVisibility(workspaceId, visibility) {
    const { data } = await getClient().put(`/api/workspaces/${workspaceId}/visibility`, { visibility });
    return data;
  },
};

module.exports = workspaces;
