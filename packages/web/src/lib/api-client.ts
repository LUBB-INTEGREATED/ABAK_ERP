import axios, { type InternalAxiosRequestConfig } from 'axios';

/**
 * True when an error (typically a React Query `error`) is an HTTP 403 from the
 * API — i.e. a permission/scope denial, not a load failure. UI surfaces use this
 * to render the no-access component instead of "we couldn't load this" / "no
 * records yet". 401 is excluded: the interceptor below already refreshes/redirects.
 */
export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Single-flight refresh (C1b). The backend's /auth/refresh is single-use and
// rotating: it deletes the presented refresh token and issues a fresh pair, so
// two concurrent 401s (e.g. a page firing list + stats together) would each
// call refresh with the same token — the second send the now-deleted token and
// gets "Refresh token not found", which used to clearSession() and bounce to
// /login. Serializing all refreshes behind one shared promise guarantees the
// rotating token is consumed exactly once per cycle, no matter how many
// requests 401 at the same moment; the rest await and replay with the new token.
let refreshPromise: Promise<void> | null = null;

async function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    const { useAuthStore } = await import('./auth');
    refreshPromise = useAuthStore
      .getState()
      .refreshAccessToken()
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

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
        await refreshOnce();
        const { useAuthStore } = await import('./auth');
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

    // Expected, handled client errors are not bugs: 401 is dealt with above
    // (refresh / redirect) and 403 is a legitimate permission/scope denial that
    // the calling component surfaces in-context. Logging them via console.error
    // turns routine auth/RBAC responses into a scary Next.js dev error overlay,
    // so demote them to debug. Genuine failures (5xx, network/no-response) still
    // log loudly.
    if (status === 401 || status === 403) {
      console.debug(
        `API ${status} ${originalRequest?.method?.toUpperCase() ?? ''} ${originalRequest?.url ?? ''}`,
      );
    } else {
      console.error('API Error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
