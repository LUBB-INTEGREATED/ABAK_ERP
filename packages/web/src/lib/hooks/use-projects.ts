import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  ClosureChecklist,
  ClosureGate,
  Phase,
  ProjectDetail,
  ProjectListResponse,
  ProjectStatus,
} from '@/lib/types/project';

const LIST_QK = ['projects', 'list'] as const;

export interface ProjectListFilter {
  status?: ProjectStatus;
  pmId?: string;
  clientId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useProjectsList(filter: ProjectListFilter = {}) {
  return useQuery<ProjectListResponse>({
    queryKey: [...LIST_QK, filter],
    queryFn: async () => {
      const res = await apiClient.get<ProjectListResponse>('/projects', {
        params: filter,
      });
      return res.data;
    },
  });
}

export function useProject(id: string | null) {
  return useQuery<ProjectDetail>({
    queryKey: ['projects', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ProjectDetail>(`/projects/${id}`);
      return res.data;
    },
  });
}

function invalidateOne(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: LIST_QK });
  qc.invalidateQueries({ queryKey: ['projects', 'detail', id] });
}

export interface CreateProjectInput {
  poId: string;
  title: string;
  description?: string;
  pmId: string;
  startDate?: string;
  expectedEndDate?: string;
  skipDefaultPhases?: boolean;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation<ProjectDetail, unknown, CreateProjectInput>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ProjectDetail>('/projects', payload);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_QK }),
  });
}

export function useCompletePhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation<
    Phase,
    unknown,
    {
      phaseId: string;
      evidenceNote?: string;
      clientAcknowledgedAt?: string;
    }
  >({
    mutationFn: async ({ phaseId, ...body }) => {
      const res = await apiClient.patch<Phase>(
        `/projects/${projectId}/phases/${phaseId}/complete`,
        body,
      );
      return res.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useAdjustPhaseProgress(projectId: string) {
  const qc = useQueryClient();
  return useMutation<
    Phase,
    unknown,
    { phaseId: string; progressPct: number; reason: string }
  >({
    mutationFn: async ({ phaseId, ...body }) => {
      const res = await apiClient.patch<Phase>(
        `/projects/${projectId}/phases/${phaseId}/adjust-progress`,
        body,
      );
      return res.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useInitiateClosure(projectId: string) {
  const qc = useQueryClient();
  return useMutation<ClosureChecklist, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.post<ClosureChecklist>(
        `/projects/${projectId}/initiate-closure`,
      );
      return res.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useSetClosureGate(projectId: string) {
  const qc = useQueryClient();
  return useMutation<
    ClosureChecklist,
    unknown,
    { gate: ClosureGate; value: boolean }
  >({
    mutationFn: async (body) => {
      const res = await apiClient.patch<ClosureChecklist>(
        `/projects/${projectId}/closure-checklist`,
        body,
      );
      return res.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useTransitionTaskStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { taskId: string; status: string }>({
    mutationFn: async ({ taskId, status }) => {
      const res = await apiClient.patch(`/tasks/${taskId}/status`, { status });
      return res.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}
