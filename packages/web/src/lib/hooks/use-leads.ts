'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Lead, LeadFilter, Paginated } from '@/lib/types/lead';

type ApiEnvelope<T> = { data: T; timestamp: string };

export function useLeadsList(filter: LeadFilter) {
  return useQuery({
    queryKey: ['leads', filter],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Paginated<Lead>>>(
        '/leads',
        { params: filter },
      );
      return data.data;
    },
  });
}

export type LeadStats = {
  total: number;
  todayCount: number;
  byStatus: { status: string; count: number }[];
  byChannel: { channel: string; count: number }[];
  bySla: { slaStatus: string; count: number }[];
};

export function useLeadStats() {
  return useQuery({
    queryKey: ['leads', 'stats'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<LeadStats>>('/leads/stats');
      return data.data;
    },
  });
}
