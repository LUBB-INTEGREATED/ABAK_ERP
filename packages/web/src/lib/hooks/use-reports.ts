'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  CatalogEntry,
  ExecutiveKpis,
  ReportResult,
  SavedReport,
} from '@/lib/types/report';

type Envelope<T> = { data: T; timestamp: string };

export function useReportCatalog() {
  return useQuery({
    queryKey: ['reports', 'catalog'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<Envelope<CatalogEntry[]>>('/reports');
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useReport(
  code: string | undefined,
  filters: Record<string, string>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['reports', 'run', code, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<Envelope<ReportResult>>(
        `/reports/${code}`,
        { params: filters },
      );
      return data.data;
    },
    enabled: enabled && Boolean(code),
  });
}

export function useSavedReports() {
  return useQuery({
    queryKey: ['reports', 'saved'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<Envelope<SavedReport[]>>('/reports/saved');
      return data.data;
    },
  });
}

export function useCreateSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      reportCode: string;
      name: string;
      filters: Record<string, string>;
    }) => apiClient.post('/reports/saved', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'saved'] }),
  });
}

export function useDeleteSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reports/saved/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'saved'] }),
  });
}

export function useExecutiveKpis() {
  return useQuery({
    queryKey: ['reports', 'executive-kpis'],
    queryFn: async () => {
      const { data } = await apiClient.get<Envelope<ExecutiveKpis>>(
        '/reports/executive-kpis',
      );
      return data.data;
    },
    refetchInterval: 60_000,
  });
}
