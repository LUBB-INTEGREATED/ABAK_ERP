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

// Visit types and sentiment aligned with BPD
export type VisitType =
  | 'CLIENT_OFFICE'
  | 'SITE'
  | 'ABAK_OFFICE'
  | 'VIRTUAL'
  | 'EVENT';

export type ClientSentiment =
  | 'VERY_INTERESTED'
  | 'INTERESTED'
  | 'NEUTRAL'
  | 'HESITANT'
  | 'NOT_INTERESTED';

export interface FieldVisit {
  id: string;
  visitType: VisitType;
  purpose: string;
  keyOutcomes: string | null;
  findings: string | null;
  nextAction: string | null;
  clientSentiment: ClientSentiment | null;
  scheduledAt: string;
  completedAt: string | null;
  locationLabel: string | null;
  attendees: string | null;
  attachmentUrls: string[];
  clientId: string | null;
  client: { id: string; clientNumber: string; contactName: string } | null;
  authorId: string | null;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function useVisits(ownerId?: string) {
  return useQuery({
    queryKey: ['visits', ownerId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<FieldVisit[]>>(
        '/pipeline/visits',
        { params: ownerId ? { ownerId } : undefined },
      );
      return data.data;
    },
  });
}

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      visitType: VisitType;
      purpose: string;
      scheduledAt: string;
      clientId?: string;
      locationLabel?: string;
      latitude?: number;
      longitude?: number;
      attendees?: string;
      keyOutcomes?: string;
      clientSentiment?: ClientSentiment;
      attachmentUrls?: string[];
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<FieldVisit>>(
        '/pipeline/visits',
        body,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visits'] }),
  });
}

export function useUpdateVisit(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      completedAt?: string;
      findings?: string;
      nextAction?: string;
      keyOutcomes?: string;
      clientSentiment?: ClientSentiment;
      attachmentUrls?: string[];
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<FieldVisit>>(
        `/pipeline/visits/${id}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visits'] }),
  });
}

export type TargetType = 'REVENUE' | 'QUOTES_SENT' | 'CONVERSIONS' | 'VISITS';
export type TargetPeriod = 'MONTHLY' | 'QUARTERLY';

export interface SalesTarget {
  id: string;
  ownerId: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  type: TargetType;
  period: TargetPeriod;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  achievedValue: number;
  createdAt: string;
  updatedAt: string;
}

export function useTargets(ownerId?: string) {
  return useQuery({
    queryKey: ['targets', ownerId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<SalesTarget[]>>(
        '/pipeline/team/targets',
        { params: ownerId ? { ownerId } : undefined },
      );
      return data.data;
    },
  });
}

export function useUpsertTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      ownerId: string;
      type: TargetType;
      period: TargetPeriod;
      periodStart: string;
      periodEnd: string;
      targetValue: number;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<SalesTarget>>(
        '/pipeline/team/targets',
        body,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['targets'] }),
  });
}
