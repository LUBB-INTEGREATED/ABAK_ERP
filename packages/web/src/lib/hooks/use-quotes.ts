'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { Quote, QuoteStatus } from '@/lib/types/quote';

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

export function useRejectQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { reason?: string }) => {
      const { data } = await apiClient.patch<ApiEnvelope<Quote>>(
        `/quotes/${id}/reject`,
        body,
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
