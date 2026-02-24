const { getClient } = require('./client');

const orgs = {
  async list() {
    const { data } = await getClient().get('/api/orgs');
    return data;
  },

  async get(orgId) {
    const { data } = await getClient().get(`/api/orgs/${orgId}`);
    return data;
  },

  async create(orgData) {
    const { data } = await getClient().post('/api/orgs', orgData);
    return data;
  },

  async update(orgId, updates) {
    const { data } = await getClient().put(`/api/orgs/${orgId}`, updates);
    return data;
  },

  async delete(orgId) {
    const { data } = await getClient().delete(`/api/orgs/${orgId}`);
    return data;
  },

  async getMembers(orgId) {
    const { data } = await getClient().get(`/api/orgs/${orgId}/members`);
    return data;
  },

  async invite(orgId, email, role) {
    const { data } = await getClient().post(`/api/orgs/${orgId}/invitations/email`, { email, role });
    return data;
  },

  async getInviteLink(orgId) {
    const { data } = await getClient().post(`/api/orgs/${orgId}/invitations/link`);
    return data;
  },

  async getInvitations(orgId) {
    const { data } = await getClient().get(`/api/orgs/${orgId}/invitations`);
    return data;
  },

  async revokeInvitation(orgId, inviteId) {
    const { data } = await getClient().delete(`/api/orgs/${orgId}/invitations/${inviteId}`);
    return data;
  },

  async removeMember(orgId, userId) {
    const { data } = await getClient().delete(`/api/orgs/${orgId}/members/${userId}`);
    return data;
  },

  async updateRole(orgId, userId, role) {
    const { data } = await getClient().put(`/api/orgs/${orgId}/members/${userId}`, { role });
    return data;
  },

  async leave(orgId) {
    const { data } = await getClient().post(`/api/orgs/${orgId}/leave`);
    return data;
  },

  async transfer(orgId, userId) {
    const { data } = await getClient().post(`/api/orgs/${orgId}/transfer-ownership`, { userId });
    return data;
  },

  async acceptInvite(token) {
    const { data } = await getClient().post(`/api/orgs/invitations/${token}/accept`);
    return data;
  },
};

module.exports = orgs;
