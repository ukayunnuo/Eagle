import axios from 'axios';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000/api/v1' : '/api/v1');

const API_ORIGIN = API_BASE_URL.startsWith('http') ? new URL(API_BASE_URL).origin : '';

export const toBackendUrl = (url: string) => {
  if (!url || /^(https?:|data:|blob:)/.test(url)) {
    return url;
  }

  if (!API_ORIGIN) {
    return url;
  }

  return url.startsWith('/') ? `${API_ORIGIN}${url}` : `${API_ORIGIN}/${url}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;
        localStorage.setItem('access_token', access_token);
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api.request(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
