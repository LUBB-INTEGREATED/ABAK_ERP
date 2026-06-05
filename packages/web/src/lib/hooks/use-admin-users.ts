import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
} from '@/lib/types/admin';

type ApiEnvelope<T> = { data: T; timestamp: string };

const QK = ['admin', 'users'] as const;

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: QK,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<AdminUser[]>>('/admin/users');
      return res.data.data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation<AdminUser, unknown, CreateUserPayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<AdminUser>>(
        '/admin/users',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation<
    AdminUser,
    unknown,
    { id: string; payload: UpdateUserPayload }
  >({
    mutationFn: async ({ id, payload }) => {
      const res = await apiClient.patch<ApiEnvelope<AdminUser>>(
        `/admin/users/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation<AdminUser, unknown, { id: string; roleIds: string[] }>({
    mutationFn: async ({ id, roleIds }) => {
      const res = await apiClient.put<ApiEnvelope<AdminUser>>(
        `/admin/users/${id}/roles`,
        { roleIds },
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useResetUserPassword() {
  return useMutation<
    { message: string },
    unknown,
    { id: string; password: string }
  >({
    mutationFn: async ({ id, password }) => {
      const res = await apiClient.post<ApiEnvelope<{ message: string }>>(
        `/admin/users/${id}/reset-password`,
        { password },
      );
      return res.data.data;
    },
  });
}
