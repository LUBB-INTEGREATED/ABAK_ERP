import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  PermissionCatalogGroup,
  Role,
  RolePermissionEntry,
} from '@/lib/types/admin';

type ApiEnvelope<T> = { data: T; timestamp: string };

const QK = ['admin', 'roles'] as const;
const CATALOG_QK = ['admin', 'permissions'] as const;

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: QK,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Role[]>>('/admin/roles');
      return res.data.data;
    },
  });
}

export function usePermissionCatalog() {
  return useQuery<PermissionCatalogGroup[]>({
    queryKey: CATALOG_QK,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<PermissionCatalogGroup[]>>(
          '/admin/permissions',
        );
      return res.data.data;
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation<
    Role,
    unknown,
    { name: string; nameAr?: string; description?: string }
  >({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<Role>>(
        '/admin/roles',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation<
    Role,
    unknown,
    { id: string; name?: string; nameAr?: string; description?: string }
  >({
    mutationFn: async ({ id, ...payload }) => {
      const res = await apiClient.patch<ApiEnvelope<Role>>(
        `/admin/roles/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation<
    Role,
    unknown,
    { id: string; permissions: RolePermissionEntry[] }
  >({
    mutationFn: async ({ id, permissions }) => {
      const res = await apiClient.put<ApiEnvelope<Role>>(
        `/admin/roles/${id}/permissions`,
        { permissions },
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, unknown, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiClient.delete<ApiEnvelope<{ message: string }>>(
        `/admin/roles/${id}`,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
