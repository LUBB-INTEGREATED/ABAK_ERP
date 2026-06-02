'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from './api-client';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  setSession: (
    user: AuthUser,
    accessToken: string,
    refreshToken: string,
  ) => void;
  clearSession: () => void;
}

function unwrap<T>(data: unknown): T {
  if (
    data &&
    typeof data === 'object' &&
    'data' in (data as Record<string, unknown>)
  ) {
    return (data as { data: T }).data;
  }
  return data as T;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const response = await apiClient.post('/auth/login', {
          email,
          password,
        });
        const { user, accessToken, refreshToken } = unwrap<{
          user: AuthUser;
          accessToken: string;
          refreshToken: string;
        }>(response.data);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      register: async (payload) => {
        const response = await apiClient.post('/auth/register', payload);
        const { user, accessToken, refreshToken } = unwrap<{
          user: AuthUser;
          accessToken: string;
          refreshToken: string;
        }>(response.data);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          try {
            await apiClient.post('/auth/logout', { refreshToken });
          } catch {
            // ignore — we clear the client session regardless
          }
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token');
        const response = await apiClient.post('/auth/refresh', {
          refreshToken,
        });
        const { accessToken, refreshToken: newRefresh } = unwrap<{
          accessToken: string;
          refreshToken: string;
        }>(response.data);
        set({ accessToken, refreshToken: newRefresh });
      },

      setSession: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearSession: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'abak-auth',
      partialize: (state) => ({
        user: state.user,
        // Persist the access token too (C1a): on reload the rehydrated store
        // would otherwise report isAuthenticated:true with accessToken:null, so
        // the first wave of requests went out with no Authorization header and
        // 401'd. The refresh token already lives in localStorage, so this
        // doesn't change the storage trust model — it removes the token-less
        // first wave that triggered the refresh stampede.
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
