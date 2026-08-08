import { getClient } from './client.js';

const auth = {
  async getMe() {
    const { data } = await getClient().get('/api/auth/me');
    return data;
  },

  async logout() {
    const { data } = await getClient().post('/api/auth/logout');
    return data;
  },

  async refreshToken() {
    const { data } = await getClient().post('/api/auth/refresh');
    return data;
  },

  async getQuota() {
    const { data } = await getClient().get('/api/auth/quota');
    return data;
  },
};

export default auth;