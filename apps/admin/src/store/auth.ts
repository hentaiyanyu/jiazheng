import { defineStore } from 'pinia';
import client, { TOKEN_KEY } from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    adminInfo: null as any,
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.token),
  },

  actions: {
    async login(username: string, password: string) {
      const data: any = await client.post('/admin/auth/login', { username, password });
      this.token = data.token;
      this.adminInfo = data.adminInfo;
      localStorage.setItem(TOKEN_KEY, data.token);
      return data;
    },

    async fetchProfile() {
      const data: any = await client.get('/admin/profile');
      this.adminInfo = data;
      return data;
    },

    logout() {
      this.token = '';
      this.adminInfo = null;
      localStorage.removeItem(TOKEN_KEY);
    },
  },
});
