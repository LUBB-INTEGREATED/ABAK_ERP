'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type ApiEnvelope<T> = { data: T; timestamp: string };

export type ServiceCategory = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  services?: { id: string }[];
};

export type AdminService = {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  description: string | null;
  basePrice: number | null;
  unit: string | null;
  isActive: boolean;
  category: ServiceCategory;
};

export function useAdminServices(includeInactive = true) {
  return useQuery({
    queryKey: ['admin', 'services', { includeInactive }],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<AdminService[]>>(
        '/services',
        { params: { includeInactive: String(includeInactive) } },
      );
      return data.data;
    },
  });
}

export function useCategoriesList(includeInactive = true) {
  return useQuery({
    queryKey: ['admin', 'service-categories', { includeInactive }],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ServiceCategory[]>>(
        '/service-categories',
        { params: { includeInactive: String(includeInactive) } },
      );
      return data.data;
    },
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'service-categories'] });
  queryClient.invalidateQueries({ queryKey: ['services'] });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<AdminService>) => {
      const { data } = await apiClient.post<ApiEnvelope<AdminService>>(
        '/services',
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Partial<AdminService>;
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<AdminService>>(
        `/services/${id}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeactivateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiEnvelope<AdminService>>(
        `/services/${id}`,
      );
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ServiceCategory>) => {
      const { data } = await apiClient.post<ApiEnvelope<ServiceCategory>>(
        '/service-categories',
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(queryClient),
  });
}
