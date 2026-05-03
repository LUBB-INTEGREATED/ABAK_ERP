import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  ClosureChecklist,
  ClosureGate,
  Phase,
  PhaseCode,
  ProjectDetail,
  ProjectListResponse,
  ProjectStatus,
  Task,
  TaskPriority,
} from '@/lib/types/project';

type ApiEnvelope<T> = { data: T; timestamp: string };

const LIST_QK = ['projects', 'list'] as const;

export interface ProjectListFilter {
  status?: ProjectStatus;
  pmId?: string;
  clientId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AvailablePurchaseOrder {
  id: string;
  poNumber: string;
  contractValue: number;
  poDate: string;
  client: { id: string; contactName: string; companyName: string | null };
  quote: { id: string; quoteNumber: string; title: string } | null;
}

export interface EligiblePm {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

export interface ProjectStats {
  total: number;
  byStatus: { status: ProjectStatus; count: number }[];
  atRisk: number;
}

export function useProjectsList(filter: ProjectListFilter = {}) {
  return useQuery<ProjectListResponse>({
    queryKey: [...LIST_QK, filter],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ProjectListResponse>>(
        '/projects',
        { params: filter },
      );
      return res.data.data;
    },
  });
}

export function useProjectStats() {
  return useQuery<ProjectStats>({
    queryKey: ['projects', 'stats'],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<ProjectStats>>('/projects/stats');
      return res.data.data;
    },
  });
}

export function useProject(id: string | null) {
  return useQuery<ProjectDetail>({
    queryKey: ['projects', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ProjectDetail>>(
        `/projects/${id}`,
      );
      return res.data.data;
    },
  });
}

export function useAvailablePurchaseOrders(enabled = true) {
  return useQuery<AvailablePurchaseOrder[]>({
    queryKey: ['projects', 'available-pos'],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<AvailablePurchaseOrder[]>>(
        '/projects/available-pos',
      );
      return res.data.data;
    },
  });
}

export function useEligiblePms(enabled = true) {
  return useQuery<EligiblePm[]>({
    queryKey: ['projects', 'eligible-pms'],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<EligiblePm[]>>(
        '/projects/eligible-pms',
      );
      return res.data.data;
    },
  });
}

export type UtilizationStatus = 'AVAILABLE' | 'BUSY' | 'OVERLOADED';

export interface ResourceWorkload {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  activeTasks: number;
  totalPlannedHours: number;
  utilizationStatus: UtilizationStatus;
}

export function useResourceWorkload() {
  return useQuery<ResourceWorkload[]>({
    queryKey: ['projects', 'resources', 'workload'],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ResourceWorkload[]>>(
        '/projects/resources/workload',
      );
      return res.data.data;
    },
  });
}

function invalidateOne(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: LIST_QK });
  qc.invalidateQueries({ queryKey: ['projects', 'detail', id] });
  qc.invalidateQueries({ queryKey: ['projects', 'stats'] });
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
      const res = await apiClient.post<ApiEnvelope<ProjectDetail>>(
        '/projects',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_QK });
      qc.invalidateQueries({ queryKey: ['projects', 'available-pos'] });
      qc.invalidateQueries({ queryKey: ['projects', 'stats'] });
    },
  });
}

// Phase mutations ------------------------------------------------

export interface AddPhaseInput {
  name: string;
  phaseCode: PhaseCode;
  customLabel?: string;
  position: number;
  ownerId: string;
  plannedStart: string;
  plannedEnd: string;
  evidenceRequired?: boolean;
}

export function useAddPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation<Phase, unknown, AddPhaseInput>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<Phase>>(
        `/projects/${projectId}/phases`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
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
      const res = await apiClient.patch<ApiEnvelope<Phase>>(
        `/projects/${projectId}/phases/${phaseId}/complete`,
        body,
      );
      return res.data.data;
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
      const res = await apiClient.patch<ApiEnvelope<Phase>>(
        `/projects/${projectId}/phases/${phaseId}/adjust-progress`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useReassignPhaseOwner(projectId: string) {
  const qc = useQueryClient();
  return useMutation<
    Phase,
    unknown,
    { phaseId: string; ownerId: string; reason: string }
  >({
    mutationFn: async ({ phaseId, ...body }) => {
      const res = await apiClient.patch<ApiEnvelope<Phase>>(
        `/projects/${projectId}/phases/${phaseId}/reassign-owner`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

// Task mutations -------------------------------------------------

export interface AddTaskInput {
  phaseId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  plannedStart?: string;
  plannedEnd?: string;
  estimatedHours?: number;
}

export function useAddTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation<Task, unknown, AddTaskInput>({
    mutationFn: async ({ phaseId, ...body }) => {
      const res = await apiClient.post<ApiEnvelope<Task>>(
        `/projects/${projectId}/phases/${phaseId}/tasks`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useTransitionTaskStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, { taskId: string; status: string }>({
    mutationFn: async ({ taskId, status }) => {
      const res = await apiClient.patch<ApiEnvelope<unknown>>(
        `/tasks/${taskId}/status`,
        { status },
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useAddDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    unknown,
    { taskId: string; blockerTaskId: string }
  >({
    mutationFn: async ({ taskId, blockerTaskId }) => {
      const res = await apiClient.post<ApiEnvelope<unknown>>(
        `/tasks/${taskId}/dependencies`,
        { blockerTaskId },
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

export function useRemoveDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    unknown,
    { taskId: string; blockerTaskId: string }
  >({
    mutationFn: async ({ taskId, blockerTaskId }) => {
      const res = await apiClient.delete<ApiEnvelope<unknown>>(
        `/tasks/${taskId}/dependencies/${blockerTaskId}`,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}

// Closure --------------------------------------------------------

export function useInitiateClosure(projectId: string) {
  const qc = useQueryClient();
  return useMutation<ClosureChecklist, unknown, void>({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<ClosureChecklist>>(
        `/projects/${projectId}/initiate-closure`,
      );
      return res.data.data;
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
      const res = await apiClient.patch<ApiEnvelope<ClosureChecklist>>(
        `/projects/${projectId}/closure-checklist`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateOne(qc, projectId),
  });
}
