import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  GovAuthorityCategory,
  GovComment,
  GovDocument,
  GovStats,
  GovTransactionDetail,
  GovTransactionListResponse,
  GovTxStatus,
  GovVisit,
  ProDashboard,
} from '@/lib/types/gov';

type ApiEnvelope<T> = { data: T; timestamp: string };

const LIST_QK = ['gov', 'list'] as const;

export interface GovListFilter {
  status?: GovTxStatus;
  authorityCategory?: GovAuthorityCategory;
  assignedProId?: string;
  projectId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useGovTransactions(filter: GovListFilter = {}) {
  return useQuery<GovTransactionListResponse>({
    queryKey: [...LIST_QK, filter],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<GovTransactionListResponse>>(
        '/gov-transactions',
        { params: filter },
      );
      return res.data.data;
    },
  });
}

export function useGovStats() {
  return useQuery<GovStats>({
    queryKey: ['gov', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<GovStats>>(
        '/gov-transactions/stats',
      );
      return res.data.data;
    },
  });
}

export function useGovTransaction(id: string | null) {
  return useQuery<GovTransactionDetail>({
    queryKey: ['gov', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<GovTransactionDetail>>(
        `/gov-transactions/${id}`,
      );
      return res.data.data;
    },
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['gov'] });
  if (id) {
    qc.invalidateQueries({ queryKey: ['gov', 'detail', id] });
  }
}

export interface CreateGovInput {
  projectId: string;
  authorityName: string;
  authorityCategory: GovAuthorityCategory;
  transactionType: string;
  referenceNumber?: string;
  assignedProId?: string;
  assignedEngineerId?: string;
  expectedResponseAt?: string;
  fees?: number;
}

export function useCreateGovTransaction() {
  const qc = useQueryClient();
  return useMutation<GovTransactionDetail, unknown, CreateGovInput>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<GovTransactionDetail>>(
        '/gov-transactions',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useTransitionGovStatus(id: string) {
  const qc = useQueryClient();
  return useMutation<
    GovTransactionDetail,
    unknown,
    { status: GovTxStatus; note?: string }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.patch<ApiEnvelope<GovTransactionDetail>>(
        `/gov-transactions/${id}/status`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc, id),
  });
}

export function useLogGovVisit(id: string) {
  const qc = useQueryClient();
  return useMutation<
    GovVisit,
    unknown,
    {
      visitedAt: string;
      purpose: string;
      outcome?: string;
      nextAction?: string;
      latitude?: number;
      longitude?: number;
    }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<GovVisit>>(
        `/gov-transactions/${id}/visits`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc, id),
  });
}

export function useLogGovComment(id: string) {
  const qc = useQueryClient();
  return useMutation<
    GovComment,
    unknown,
    { commentText: string; issuedAt: string }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<GovComment>>(
        `/gov-transactions/${id}/comments`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc, id),
  });
}

export function useRespondToGovComment(transactionId: string) {
  const qc = useQueryClient();
  return useMutation<
    GovComment,
    unknown,
    { commentId: string; responseText: string }
  >({
    mutationFn: async ({ commentId, responseText }) => {
      const res = await apiClient.patch<ApiEnvelope<GovComment>>(
        `/gov-transactions/comments/${commentId}/respond`,
        { responseText },
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc, transactionId),
  });
}

export function useUploadGovDocument(id: string) {
  const qc = useQueryClient();
  return useMutation<
    GovDocument,
    unknown,
    { title: string; fileUrl: string; mimeType?: string }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<GovDocument>>(
        `/gov-transactions/${id}/documents`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc, id),
  });
}

export function useWeeklyStatusUpdate(id: string) {
  const qc = useQueryClient();
  return useMutation<GovTransactionDetail, unknown, { note?: string }>({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<GovTransactionDetail>>(
        `/gov-transactions/${id}/weekly-status-update`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc, id),
  });
}

export function useProDashboard() {
  return useQuery<ProDashboard>({
    queryKey: ['gov', 'pro-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ProDashboard>>(
        '/gov-transactions/pro/dashboard',
      );
      return res.data.data;
    },
  });
}
