import { create } from 'zustand';
import { authApi } from '@/lib/api/auth';
import { User, UserStore } from '@/types/user';

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : false,

  setToken: (token: string) => {
    localStorage.setItem('access_token', token);
    set({ token, isAuthenticated: true });
  },

  login: async (username: string, password: string) => {
    try {
      const response = await authApi.login({ username, password });
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      set({
        token: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
      });
      // 获取用户信息
      await get().fetchUserInfo();
    } catch (error) {
      throw error;
    }
  },

  register: async (username: string, password: string) => {
    try {
      await authApi.register({ username, password });
      // 注册成功后自动登录
      await get().login(username, password);
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  refreshAccessToken: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await authApi.refresh(refreshToken);
      localStorage.setItem('access_token', response.access_token);
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
      }
      set({
        token: response.access_token,
        refreshToken: response.refresh_token || refreshToken,
      });
    } catch (error) {
      get().logout();
      throw error;
    }
  },

  fetchUserInfo: async () => {
    try {
      const user = await authApi.getMe();
      set({ user });
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  },
}));
