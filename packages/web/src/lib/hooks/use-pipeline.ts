'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  PipelineEntry,
  PipelineStage,
  PipelineStatsPayload,
} from '@/lib/types/pipeline';

type ApiEnvelope<T> = { data: T; timestamp: string };
type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export function usePipeline(filter?: { ownerId?: string; search?: string }) {
  return useQuery({
    queryKey: ['pipeline', filter],
    queryFn: async () => {
      const { data } = await apiClient.get<
        ApiEnvelope<Paginated<PipelineEntry>>
      >('/pipeline', { params: { ...filter, limit: 200 } });
      return data.data;
    },
  });
}

export function usePipelineStats() {
  return useQuery({
    queryKey: ['pipeline', 'stats'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<PipelineStatsPayload>>(
          '/pipeline/stats',
        );
      return data.data;
    },
  });
}

export function useMoveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      id: string;
      stage: PipelineStage;
      reason?: string;
      postponedUntil?: string;
    }) => {
      const { id, ...rest } = body;
      const { data } = await apiClient.patch<
        ApiEnvelope<{ entry: PipelineEntry }>
      >(`/pipeline/entries/${id}/stage`, rest);
      return data.data.entry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      leadId?: string;
      clientId?: string;
      ownerId?: string;
      estimatedValue?: number;
      probability?: number;
      expectedCloseAt?: string;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<PipelineEntry>>(
        '/pipeline/entries',
        body,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline'] }),
  });
}
