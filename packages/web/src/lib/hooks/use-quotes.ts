'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Quote, QuoteSection, QuoteStatus } from '@/lib/types/quote';

type ApiEnvelope<T> = { data: T; timestamp: string };
type Paginated<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export function useQuotes(filter?: {
  status?: QuoteStatus;
  clientId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['quotes', filter],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Paginated<Quote>>>(
        '/quotes',
        { params: filter },
      );
      return data.data;
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Quote>>(`/quotes/${id}`);
      return data.data;
    },
    enabled: Boolean(id),
  });
}

export type QuoteStats = {
  total: number;
  pendingApproval: number;
  acceptedCount: number;
  acceptedValue: number;
  byStatus: { status: string; count: number; totalValue: number }[];
};

export function useQuoteStats() {
  return useQuery({
    queryKey: ['quotes', 'stats'],
    queryFn: async () => {
      const { data } =
        await apiClient.get<ApiEnvelope<QuoteStats>>('/quotes/stats');
      return data.data;
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['quotes'] });
  if (id) qc.invalidateQueries({ queryKey: ['quotes', id] });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiEnvelope<Quote>>(
        '/quotes',
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useSubmitQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { approverId?: string } = {}) => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/submit`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

// DM-15c §14 — per-department sections (compile view + section lifecycle).
export function useQuoteSections(id: string | undefined) {
  return useQuery({
    queryKey: ['quotes', id, 'sections'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<QuoteSection[]>>(
        `/quotes/${id}/sections`,
      );
      return data.data;
    },
    enabled: Boolean(id),
  });
}

function invalidateSections(
  qc: ReturnType<typeof useQueryClient>,
  quoteId: string,
) {
  qc.invalidateQueries({ queryKey: ['quotes', quoteId, 'sections'] });
  invalidate(qc, quoteId);
}

// A dept pricer submits their own section to the lead (DRAFT → SUBMITTED_TO_LEAD).
export function useSubmitSection(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sectionId: string) => {
      const { data } = await apiClient.patch<ApiEnvelope<QuoteSection>>(
        `/quotes/${quoteId}/sections/${sectionId}/submit`,
      );
      return data.data;
    },
    onSuccess: () => invalidateSections(qc, quoteId),
  });
}

export function useSendQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/send`,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

export function useAcceptQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/accept`,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

/**
 * 1-click conversion of a Won quote to a live Project. Department Manager
 * action — 2026-05-21 process correction (see docs/CORRECTED_CLIENT_JOURNEY.md §G).
 * Returns the created Project; the caller should redirect to its detail page.
 */
export function useConvertQuoteToProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: {
        title?: string;
        description?: string;
        startDate?: string;
      } = {},
    ) => {
      const { data } = await apiClient.post<
        ApiEnvelope<{ id: string; projectNumber: string }>
      >(`/quotes/${id}/convert-to-project`, body);
      return data.data;
    },
    onSuccess: () => {
      invalidate(qc, id);
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useRejectQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { reasonCode: string; reason?: string }) => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/reject`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

export function useReviseQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiEnvelope<Quote>>(
        `/quotes/${id}/revise`,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

export function useDecideApproval(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      approvalId: string;
      status: 'APPROVED' | 'REJECTED';
      comments?: string;
    }) => {
      const { approvalId, ...body } = args;
      const { data } = await apiClient.patch<ApiEnvelope<unknown>>(
        `/quotes/${quoteId}/approvals/${approvalId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, quoteId),
  });
}

export function usePostponeQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { followUpDate: string; notes?: string }) => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/postpone`,
        body,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

export function useSetInDiscussion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/in-discussion`,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}

export function useSetInNegotiation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/in-negotiation`,
      );
      return data.data;
    },
    onSuccess: () => invalidate(qc, id),
  });
}
