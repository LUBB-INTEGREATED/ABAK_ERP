import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  CreateDepartmentPayload,
  Department,
  UpdateDepartmentPayload,
} from '@/lib/types/admin';

type ApiEnvelope<T> = { data: T; timestamp: string };

const QK = ['admin', 'departments'] as const;

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: QK,
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Department[]>>('/admin/departments');
      return res.data.data;
    },
  });
}

// DM-15a: a department's members (+ manager) for the Accept sheet's pricer
// picker — gated by rfq:assign_pricers, manager-scoped. `departmentId` is a REAL
// Department id (fold the section's ServiceCategory → Department first).
export type DepartmentMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  isManager: boolean;
};

export function useDepartmentMembers(departmentId: string | null | undefined) {
  return useQuery<DepartmentMember[]>({
    queryKey: ['departments', departmentId, 'members'],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<DepartmentMember[]>>(
        `/departments/${departmentId}/members`,
      );
      return res.data.data;
    },
    enabled: Boolean(departmentId),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation<Department, unknown, CreateDepartmentPayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<Department>>(
        '/admin/departments',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation<
    Department,
    unknown,
    { id: string; payload: UpdateDepartmentPayload }
  >({
    mutationFn: async ({ id, payload }) => {
      const res = await apiClient.patch<ApiEnvelope<Department>>(
        `/admin/departments/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, unknown, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiClient.delete<ApiEnvelope<{ message: string }>>(
        `/admin/departments/${id}`,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
