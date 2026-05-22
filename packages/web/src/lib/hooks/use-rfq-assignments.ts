'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type ApiEnvelope<T> = { data: T; timestamp: string };

export type RfqAssignmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'REVISION_REQUESTED';

export type RfqAssignment = {
  id: string;
  rfqId: string;
  assigneeId: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    nameAr: string | null;
  };
  isLeadPricer: boolean;
  status: RfqAssignmentStatus;
  assignedAt: string;
  submittedAt: string | null;
  notes: string | null;
};

export function useRfqAssignments(rfqId: string | undefined) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'assignments'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<RfqAssignment[]>>(
        `/rfqs/${rfqId}/assignments`,
      );
      return data.data;
    },
    enabled: Boolean(rfqId),
  });
}

export function useCreateRfqAssignment(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      departmentId: string;
      assigneeId: string;
      isLeadPricer?: boolean;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<RfqAssignment>>(
        `/rfqs/${rfqId}/assignments`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rfqs', rfqId, 'assignments'] });
      void qc.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });
}

export function useUpdateRfqAssignment(rfqId: string, assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      assigneeId?: string;
      isLeadPricer?: boolean;
      status?: RfqAssignmentStatus;
      notes?: string;
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<RfqAssignment>>(
        `/rfqs/${rfqId}/assignments/${assignmentId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rfqs', rfqId, 'assignments'] });
      void qc.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });
}

export function useRemoveRfqAssignment(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiClient.delete(`/rfqs/${rfqId}/assignments/${assignmentId}`);
      return assignmentId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rfqs', rfqId, 'assignments'] });
      void qc.invalidateQueries({ queryKey: ['rfqs', rfqId] });
    },
  });
}

export type Department = {
  id: string;
  name: string;
  nameAr: string | null;
};

export function useDepartments() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Department[]>>(
        '/service-categories',
      );
      return data.data;
    },
  });
}

// ------------------------------------------------------------------
// Doc requests + site-visit requests on an RFQ
// ------------------------------------------------------------------

export type RfqRequestStatus = 'OPEN' | 'RESOLVED' | 'CANCELLED';

export type RfqDocRequest = {
  id: string;
  rfqId: string;
  requestedById: string;
  description: string;
  status: RfqRequestStatus;
  response: string | null;
  attachmentUrl: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type RfqSiteVisitRequest = {
  id: string;
  rfqId: string;
  requestedById: string;
  purpose: string;
  preferredDateFrom: string | null;
  preferredDateTo: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  status: RfqRequestStatus;
  notes: string | null;
  createdAt: string;
};

export function useRfqDocRequests(rfqId: string | undefined) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'doc-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<RfqDocRequest[]>>(
        `/rfqs/${rfqId}/doc-requests`,
      );
      return data.data;
    },
    enabled: Boolean(rfqId),
  });
}

export function useCreateRfqDocRequest(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { description: string }) => {
      const { data } = await apiClient.post<ApiEnvelope<RfqDocRequest>>(
        `/rfqs/${rfqId}/doc-requests`,
        body,
      );
      return data.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['rfqs', rfqId, 'doc-requests'] }),
  });
}

export function useUpdateRfqDocRequest(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      ...body
    }: {
      requestId: string;
      response?: string;
      attachmentUrl?: string;
      status?: RfqRequestStatus;
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<RfqDocRequest>>(
        `/rfqs/${rfqId}/doc-requests/${requestId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['rfqs', rfqId, 'doc-requests'] }),
  });
}

export function useRfqSiteVisitRequests(rfqId: string | undefined) {
  return useQuery({
    queryKey: ['rfqs', rfqId, 'site-visit-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<RfqSiteVisitRequest[]>>(
        `/rfqs/${rfqId}/site-visit-requests`,
      );
      return data.data;
    },
    enabled: Boolean(rfqId),
  });
}

export function useCreateRfqSiteVisitRequest(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      purpose: string;
      preferredDateFrom?: string;
      preferredDateTo?: string;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<RfqSiteVisitRequest>>(
        `/rfqs/${rfqId}/site-visit-requests`,
        body,
      );
      return data.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['rfqs', rfqId, 'site-visit-requests'],
      }),
  });
}

export function useUpdateRfqSiteVisitRequest(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      ...body
    }: {
      requestId: string;
      status?: RfqRequestStatus;
      scheduledAt?: string;
      completedAt?: string;
      notes?: string;
    }) => {
      const { data } = await apiClient.patch<ApiEnvelope<RfqSiteVisitRequest>>(
        `/rfqs/${rfqId}/site-visit-requests/${requestId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['rfqs', rfqId, 'site-visit-requests'],
      }),
  });
}
