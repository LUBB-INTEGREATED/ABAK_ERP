import axios, { type InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const { useAuthStore } = await import('./auth');
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint =
      typeof originalRequest?.url === 'string' &&
      originalRequest.url.startsWith('/auth/');

    if (
      typeof window !== 'undefined' &&
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;
      try {
        const { useAuthStore } = await import('./auth');
        await useAuthStore.getState().refreshAccessToken();
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
          originalRequest.headers?.set(
            'Authorization',
            `Bearer ${accessToken}`,
          );
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        const { useAuthStore } = await import('./auth');
        useAuthStore.getState().clearSession();
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login'
        ) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  },
);

export default apiClient;
