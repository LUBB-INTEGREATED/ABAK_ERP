export type ProjectStatus =
  | 'PLANNING'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'AT_RISK'
  | 'CLOSING'
  | 'CLOSED'
  | 'CANCELLED';

export type PhaseStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'SKIPPED';

export type PhaseCode =
  | 'INITIATION'
  | 'KICKOFF'
  | 'EXECUTION'
  | 'REVIEW'
  | 'SUBMISSION'
  | 'REVISIONS'
  | 'CLOSURE'
  | 'CUSTOM';

export type TaskStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REVIEW'
  | 'DONE'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface UserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
}

export interface ProjectListItem {
  id: string;
  projectNumber: string;
  title: string;
  status: ProjectStatus;
  contractValue: number;
  actualProgress: number;
  startDate: string | null;
  expectedEndDate: string | null;
  client: { id: string; contactName: string; companyName: string | null };
  pm: UserSummary;
  _count?: { phases: number; tasks: number };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee: UserSummary | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  blockers: { blocker: { id: string; title: string; status: TaskStatus } }[];
  dependents: {
    dependent: { id: string; title: string; status: TaskStatus };
  }[];
}

export interface Phase {
  id: string;
  name: string;
  phaseCode: PhaseCode;
  customLabel: string | null;
  position: number;
  ownerId: string;
  owner: UserSummary;
  status: PhaseStatus;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  progressPct: number;
  pmAdjustment: number | null;
  pmAdjustmentNote: string | null;
  evidenceRequired: boolean;
  evidenceNote: string | null;
  clientAcknowledgedAt: string | null;
  completedAt: string | null;
  tasks: Task[];
}

export interface ClosureChecklist {
  id: string;
  projectId: string;
  allPhasesCompleted: boolean;
  allPhasesCompletedAt: string | null;
  deliverablesSubmitted: boolean;
  deliverablesSubmittedAt: string | null;
  clientApprovalReceived: boolean;
  clientApprovalReceivedAt: string | null;
  finalPaymentReceived: boolean;
  finalPaymentReceivedAt: string | null;
  financeClearanceIssued: boolean;
  financeClearanceIssuedAt: string | null;
  initiatedAt: string;
  closedAt: string | null;
}

export type ClosureGate =
  | 'ALL_PHASES_COMPLETED'
  | 'DELIVERABLES_SUBMITTED'
  | 'CLIENT_APPROVAL_RECEIVED'
  | 'FINAL_PAYMENT_RECEIVED'
  | 'FINANCE_CLEARANCE_ISSUED';

export interface ProjectDetail extends Omit<ProjectListItem, '_count'> {
  description: string | null;
  actualEndDate: string | null;
  plannedProgress: number;
  financialRiskFlagged: boolean;
  financialRiskFlaggedAt: string | null;
  po: { id: string; poNumber: string; contractValue: number; status: string };
  phases: Phase[];
  closureChecklist: ClosureChecklist | null;
}

export interface ProjectListResponse {
  data: ProjectListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}
