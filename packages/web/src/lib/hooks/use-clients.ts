'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  Client,
  ClientClassification,
  ClientFilter,
  FollowUp,
  Interaction,
  InteractionType,
  ClientNote,
  FollowUpStatus,
  FollowUpType,
  InteractionDirection,
  NoteTag,
} from '@/lib/types/client';

type ApiEnvelope<T> = { data: T; timestamp: string };
type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export function useClientsList(filter: ClientFilter) {
  return useQuery({
    queryKey: ['clients', filter],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Paginated<Client>>>(
        '/clients',
        { params: filter },
      );
      return data.data;
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Client>>(
        `/clients/${id}`,
      );
      return data.data;
    },
    enabled: Boolean(id),
  });
}

export type ClientStats = {
  total: number;
  todayCount: number;
  averageLifetimeValue: number;
  byClassification: { classification: string; count: number }[];
  byStatus: { status: string; count: number }[];
};

export function useClientStats() {
  return useQuery({
    queryKey: ['clients', 'stats'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<ClientStats>>('/clients/stats');
      return data.data;
    },
  });
}

export function useClientInteractions(
  clientId: string | undefined,
  filter?: { type?: InteractionType; search?: string },
) {
  return useQuery({
    queryKey: ['clients', clientId, 'interactions', filter],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Paginated<Interaction>>>(
        `/clients/${clientId}/interactions`,
        { params: filter },
      );
      return data.data;
    },
    enabled: Boolean(clientId),
  });
}

export function useClientFollowUps(clientId: string | undefined) {
  return useQuery({
    queryKey: ['clients', clientId, 'follow-ups'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<FollowUp[]>>(
        `/clients/${clientId}/follow-ups`,
      );
      return data.data;
    },
    enabled: Boolean(clientId),
  });
}

export function useClientNotes(clientId: string | undefined) {
  return useQuery({
    queryKey: ['clients', clientId, 'notes'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<ClientNote[]>>(
        `/clients/${clientId}/notes`,
      );
      return data.data;
    },
    enabled: Boolean(clientId),
  });
}

function invalidateClient(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['clients'] });
  qc.invalidateQueries({ queryKey: ['clients', id] });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiEnvelope<Client>>(
        '/clients',
        body,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.patch<ApiEnvelope<Client>>(
        `/clients/${id}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, id),
  });
}

export function useClassifyClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      classification: ClientClassification;
      manual?: boolean;
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<Client>>(
        `/clients/${id}/classify`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, id),
  });
}

export function useArchiveClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<ApiEnvelope<Client>>(
        `/clients/${id}`,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, id),
  });
}

export function useAddInteraction(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      type: InteractionType;
      direction?: InteractionDirection;
      visibility?: 'TEAM' | 'MANAGER_ONLY' | 'PRIVATE';
      subject: string;
      summary?: string;
      occurredAt?: string;
      durationMinutes?: number;
      location?: string;
      outcome?: string;
      nextAction?: string;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<Interaction>>(
        `/clients/${clientId}/interactions`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useAddFollowUp(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      description?: string;
      type?: FollowUpType;
      dueAt: string;
      assignedToId?: string;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<FollowUp>>(
        `/clients/${clientId}/follow-ups`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useUpdateFollowUp(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        status?: FollowUpStatus;
        dueAt?: string;
        outcome?: string;
        assignedToId?: string;
      };
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<FollowUp>>(
        `/clients/follow-ups/${id}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useCloseFollowUp(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      closureOutcome,
      outcome,
      newDueAt,
      reason,
    }: {
      id: string;
      closureOutcome:
        | 'COMPLETED'
        | 'RESCHEDULED'
        | 'CLIENT_NOT_REACHABLE'
        | 'CANCELLED';
      outcome?: string;
      newDueAt?: string;
      reason?: string;
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<FollowUp>>(
        `/clients/follow-ups/${id}`,
        { closureOutcome, outcome, newDueAt, reason },
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useAddNote(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { body: string; tag?: NoteTag }) => {
      const { data } = await apiClient.post<ApiEnvelope<ClientNote>>(
        `/clients/${clientId}/notes`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}

export function useDeleteNote(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      await apiClient.delete(`/clients/notes/${noteId}`);
      return noteId;
    },
    onSuccess: () => invalidateClient(qc, clientId),
  });
}
