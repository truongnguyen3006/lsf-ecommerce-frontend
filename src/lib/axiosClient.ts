import axios from 'axios';
import { authApi } from '@/services/authApi';
import { useAuthStore } from '@/store/useAuthStore';

const axiosClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('access_token');
      const isRefreshRequest = config.url?.includes('/auth/refresh');

      if (token && !isRefreshRequest) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url && originalRequest.url.includes('/auth/refresh')) {
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = sessionStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const res = await authApi.refreshToken(refreshToken);

        sessionStorage.setItem('access_token', res.access_token);
        sessionStorage.setItem('refresh_token', res.refresh_token);
        useAuthStore.getState().syncToken(res.access_token);

        originalRequest.headers.Authorization = `Bearer ${res.access_token}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
