import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  RfqDeclineType,
  RfqDetail,
  RfqListResponse,
  RfqPriority,
  RfqSource,
  RfqStatus,
} from '@/lib/types/rfq';

type ApiEnvelope<T> = { data: T; timestamp: string };

const LIST_QK = ['rfqs', 'list'] as const;

export interface RfqListFilter {
  status?: RfqStatus;
  clientId?: string;
  source?: RfqSource;
  priority?: RfqPriority;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useRfqsList(filter: RfqListFilter = {}) {
  return useQuery<RfqListResponse>({
    queryKey: [...LIST_QK, filter],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<RfqListResponse>>('/rfqs', {
        params: filter,
      });
      return res.data.data;
    },
  });
}

export function useRfq(id: string | null) {
  return useQuery<RfqDetail>({
    queryKey: ['rfqs', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<RfqDetail>>(`/rfqs/${id}`);
      return res.data.data;
    },
  });
}

export interface CreateRfqInput {
  opportunityId: string;
  serviceType: string;
  projectScope: string;
  priority?: RfqPriority;
  requestedByChannel: RfqSource;
  brokerName?: string;
  brokerPhone?: string;
}

export function useCreateRfq() {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, CreateRfqInput>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        '/rfqs',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_QK });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

function invalidateOne(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: LIST_QK });
  qc.invalidateQueries({ queryKey: ['rfqs', 'detail', id] });
}

// ── Thin-RFQ seam endpoints (DM-4/5/6/14) ───────────────────────────────────

export interface StartPricingResult {
  quoteId: string;
  quoteNumber: string;
}

/** Accept + assign: mint the Draft Quote and flip the RFQ to PRICING. */
export function useStartPricing(id: string) {
  const qc = useQueryClient();
  return useMutation<StartPricingResult, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<StartPricingResult>>(
        `/rfqs/${id}/start-pricing`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      invalidateOne(qc, id);
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export interface DeclineRfqInput {
  type: RfqDeclineType;
  reason: string;
}

/** Dept manager declines ("Not us") with a required reason. */
export function useDeclineRfq(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, DeclineRfqInput>({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/decline`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

export interface RerouteRfqInput {
  requestedCategoryIds: string[];
}

/** Sales re-routes a wrong-department decline back into triage. */
export function useRerouteRfq(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, RerouteRfqInput>({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/reroute`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

/** Un-accept: return an in-pricing RFQ with an empty draft to triage. */
export function useUnacceptRfq(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/unaccept`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      invalidateOne(qc, id);
      qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useCancelRfq(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/cancel`,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}
