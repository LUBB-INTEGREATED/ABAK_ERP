import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  ConfirmationType,
  RfqDetail,
  RfqDispatchChannel,
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
  coordinatorId?: string;
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

export function useAssignCoordinator(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, { coordinatorId: string }>({
    mutationFn: async (body) => {
      const res = await apiClient.patch<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/assign-coordinator`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

export function useAssignContributor(id: string) {
  const qc = useQueryClient();
  return useMutation<
    RfqDetail,
    unknown,
    { role: 'TECHNICAL' | 'FINANCIAL'; userId: string }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.patch<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/assign-contributor`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

export function useStartPreparation(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.patch<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/start-preparation`,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

export function useSubmitForApproval(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/submit-for-approval`,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

export function useDispatchRfq(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, { channel: RfqDispatchChannel }>({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/dispatch`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
  });
}

export interface OutcomeInput {
  outcome: 'WON' | 'LOST' | 'POSTPONED';
  confirmationType?: ConfirmationType;
  confirmationAt?: string;
  confirmationValue?: number;
  confirmationDocUrl?: string;
  lostReason?: string;
  postponedUntil?: string;
}

export function useRecordOutcome(id: string) {
  const qc = useQueryClient();
  return useMutation<RfqDetail, unknown, OutcomeInput>({
    mutationFn: async (body) => {
      const res = await apiClient.post<ApiEnvelope<RfqDetail>>(
        `/rfqs/${id}/outcome`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, id),
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
