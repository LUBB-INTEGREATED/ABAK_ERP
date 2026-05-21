'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  Lead,
  LeadAssignee,
  LeadFilter,
  LeadStatus,
  Paginated,
} from '@/lib/types/lead';

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

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Lead>>(`/leads/${id}`);
      return data.data;
    },
    enabled: Boolean(id),
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

type UsersResponse = {
  message: string;
  count: number;
  users: (LeadAssignee & { role: string; status: string })[];
};

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<UsersResponse>>('/users');
      return data.data.users;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type ServiceOption = {
  id: string;
  code: string;
  name: string;
  category: { id: string; name: string };
};

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<ServiceOption[]>>('/services');
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiEnvelope<Lead>>('/leads', body);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

function invalidateLead(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  queryClient.invalidateQueries({ queryKey: ['leads'] });
  queryClient.invalidateQueries({ queryKey: ['leads', id] });
}

export function useAssignLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignedToId: string) => {
      const { data } = await apiClient.patch<ApiEnvelope<Lead>>(
        `/leads/${id}/assign`,
        { assignedToId },
      );
      return data.data;
    },
    onSuccess: () => invalidateLead(queryClient, id),
  });
}

export function useUpdateLeadStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { status: LeadStatus; reason?: string }) => {
      const { data } = await apiClient.patch<ApiEnvelope<Lead>>(
        `/leads/${id}/status`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateLead(queryClient, id),
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Lead>) => {
      const { data } = await apiClient.patch<ApiEnvelope<Lead>>(
        `/leads/${id}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateLead(queryClient, id),
  });
}

export function useDeleteLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<ApiEnvelope<Lead>>(
        `/leads/${id}`,
      );
      return data.data;
    },
    onSuccess: () => invalidateLead(queryClient, id),
  });
}

// ============================================================
// Communications log on a lead (2026-05-21 process correction).
// See docs/CORRECTED_CLIENT_JOURNEY.md §A.
// ============================================================

export type InteractionType =
  | 'CALL'
  | 'MEETING'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'COMPLAINT'
  | 'SITE_VISIT'
  | 'OFFICE_VISIT'
  | 'QUOTE_SENT_EVENT'
  | 'CONTRACT_SIGNED'
  | 'NOTE';

export type LeadInteraction = {
  id: string;
  leadId: string | null;
  type: InteractionType;
  direction: 'INBOUND' | 'OUTBOUND' | null;
  subject: string;
  summary: string | null;
  occurredAt: string;
  durationMinutes: number | null;
  location: string | null;
  outcome: string | null;
  nextAction: string | null;
  ccAuthorIds: string[];
  followUpDate: string | null;
  authorId: string | null;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  createdAt: string;
};

export function useLeadInteractions(leadId: string | undefined) {
  return useQuery({
    queryKey: ['leads', leadId, 'interactions'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<LeadInteraction[]>>(
        `/leads/${leadId}/interactions`,
      );
      return data.data;
    },
    enabled: Boolean(leadId),
  });
}

export type LogLeadInteractionBody = {
  type: InteractionType;
  direction?: 'INBOUND' | 'OUTBOUND';
  subject: string;
  summary?: string;
  occurredAt?: string;
  durationMinutes?: number;
  location?: string;
  outcome?: string;
  nextAction?: string;
  ccAuthorIds?: string[];
  followUpDate?: string;
};

export function useLogLeadInteraction(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LogLeadInteractionBody) => {
      const { data } = await apiClient.post<ApiEnvelope<LeadInteraction>>(
        `/leads/${leadId}/interactions`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['leads', leadId, 'interactions'],
      });
      void queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
    },
  });
}
