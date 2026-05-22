'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type ApiEnvelope<T> = { data: T; timestamp: string };

export type LicenceStatus = 'APPLIED' | 'UNDER_REVIEW' | 'ISSUED' | 'REJECTED';

export type BlockedPhase = {
  id: string;
  name: string;
  status: string;
};

export type Licence = {
  id: string;
  projectId: string;
  name: string;
  portalName: string;
  portalUrl: string | null;
  requestId: string | null;
  status: LicenceStatus;
  appliedDate: string;
  issuedDate: string | null;
  rejectedDate: string | null;
  rejectionReason: string | null;
  appliedById: string | null;
  lastCheckedAt: string | null;
  reminderCadenceDays: number;
  parentLicenceId: string | null;
  notes: string | null;
  blockedPhases: BlockedPhase[];
  createdAt: string;
  updatedAt: string;
};

export function useProjectLicences(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'licences'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Licence[]>>(
        `/projects/${projectId}/licences`,
      );
      return data.data;
    },
    enabled: Boolean(projectId),
  });
}

export type CreateLicenceBody = {
  name: string;
  portalName: string;
  portalUrl?: string;
  requestId?: string;
  appliedDate: string;
  notes?: string;
  reminderCadenceDays?: number;
  blockedPhaseIds?: string[];
};

export function useCreateLicence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateLicenceBody) => {
      const { data } = await apiClient.post<ApiEnvelope<Licence>>(
        `/projects/${projectId}/licences`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'licences'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId],
      });
    },
  });
}

export type UpdateLicenceBody = Partial<{
  name: string;
  portalName: string;
  portalUrl: string;
  requestId: string;
  status: LicenceStatus;
  appliedDate: string;
  issuedDate: string;
  rejectionReason: string;
  notes: string;
  reminderCadenceDays: number;
  blockedPhaseIds: string[];
}>;

export function useUpdateLicence(projectId: string, licenceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateLicenceBody) => {
      const { data } = await apiClient.patch<ApiEnvelope<Licence>>(
        `/projects/${projectId}/licences/${licenceId}`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'licences'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId],
      });
    },
  });
}

// ------------------------------------------------------------------
// CEO override on phase ↔ licence dependency
// ------------------------------------------------------------------

export function useOverridePhaseLicenceBlock(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      phaseId,
      justification,
    }: {
      phaseId: string;
      justification: string;
    }) => {
      const { data } = await apiClient.post<ApiEnvelope<unknown>>(
        `/projects/${projectId}/phases/${phaseId}/licence-override`,
        { justification },
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'licences'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId],
      });
    },
  });
}

export function useClearPhaseLicenceOverride(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phaseId: string) => {
      const { data } = await apiClient.delete<ApiEnvelope<unknown>>(
        `/projects/${projectId}/phases/${phaseId}/licence-override`,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'licences'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId],
      });
    },
  });
}
