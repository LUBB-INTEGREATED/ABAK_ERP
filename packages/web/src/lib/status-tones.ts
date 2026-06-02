import type { StatusVariant } from '@/components/ui/status-badge';
import type {
  ClientClassification,
  ClientStatus,
  FollowUpStatus,
} from './types/client';
import type { GovTxStatus } from './types/gov';
import type { LeadPriority, LeadStatus, SLAStatus } from './types/lead';
import type { PhaseStatus, ProjectStatus, TaskStatus } from './types/project';
import type { QuoteStatus } from './types/quote';
import type { RfqPriority, RfqStatus } from './types/rfq';
import type { InvoiceStatus } from './types/finance';

/**
 * Central status → variant mapping. See DESIGN_SYSTEM_MASTER.md §2.
 *
 * Rules of thumb when adding a new status:
 *   - In-flight, no decision needed → info
 *   - In-flight, decision needed soon → warning
 *   - Closed positive → success
 *   - Closed negative → error
 *   - Inactive / parked → muted
 */

export function quoteStatusVariant(s: QuoteStatus): StatusVariant {
  switch (s) {
    case 'WON':
      return 'success';
    case 'PENDING_APPROVAL':
    case 'IN_REVISION':
    case 'IN_NEGOTIATION':
      return 'warning';
    case 'LOST':
    case 'EXPIRED':
      return 'error';
    case 'POSTPONED':
    case 'CANCELLED':
    case 'DRAFT':
      return 'muted';
    case 'PENDING_REVIEW':
    case 'APPROVED':
    case 'SENT':
    case 'IN_DISCUSSION':
    case 'REVISED':
      return 'info';
  }
}

export function rfqStatusVariant(s: RfqStatus): StatusVariant {
  switch (s) {
    case 'WON':
      return 'success';
    case 'PENDING_APPROVAL':
      return 'warning';
    case 'LOST':
      return 'error';
    case 'POSTPONED':
    case 'CANCELLED':
      return 'muted';
    case 'RECEIVED':
    case 'ASSIGNED':
    case 'IN_PREPARATION':
    case 'APPROVED_READY_FOR_DISPATCH':
    case 'SENT':
      return 'info';
  }
}

export function rfqPriorityVariant(p: RfqPriority): StatusVariant {
  switch (p) {
    case 'URGENT':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'NORMAL':
      return 'info';
  }
}

export function projectStatusVariant(s: ProjectStatus): StatusVariant {
  switch (s) {
    case 'CLOSED':
      return 'success';
    case 'AT_RISK':
    case 'ON_HOLD':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    case 'PLANNING':
      return 'muted';
    case 'ACTIVE':
    case 'CLOSING':
      return 'info';
  }
}

export function phaseStatusVariant(s: PhaseStatus): StatusVariant {
  switch (s) {
    case 'COMPLETED':
      return 'success';
    case 'BLOCKED':
      return 'error';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'SKIPPED':
      return 'muted';
    case 'NOT_STARTED':
    case 'IN_PROGRESS':
      return 'info';
  }
}

export function taskStatusVariant(s: TaskStatus): StatusVariant {
  switch (s) {
    case 'DONE':
      return 'success';
    case 'BLOCKED':
      return 'error';
    case 'REVIEW':
      return 'warning';
    case 'CANCELLED':
      return 'muted';
    case 'NOT_STARTED':
    case 'IN_PROGRESS':
      return 'info';
  }
}

export function clientStatusVariant(s: ClientStatus): StatusVariant {
  switch (s) {
    case 'ACTIVE':
      return 'info';
    case 'INACTIVE':
      return 'muted';
    case 'BLACKLISTED':
      return 'error';
  }
}

export function clientClassificationVariant(
  c: ClientClassification,
): StatusVariant {
  switch (c) {
    case 'VIP':
      return 'success';
    case 'NEW':
    case 'RETURNING':
      return 'info';
    case 'DORMANT':
      return 'warning';
    case 'ARCHIVED':
      return 'muted';
  }
}

export function followUpStatusVariant(s: FollowUpStatus): StatusVariant {
  switch (s) {
    case 'COMPLETED':
      return 'success';
    case 'OVERDUE':
      return 'error';
    case 'DUE_TODAY':
      return 'warning';
    case 'CANCELLED':
      return 'muted';
    case 'PENDING':
      return 'info';
  }
}

export function leadStatusVariant(s: LeadStatus): StatusVariant {
  switch (s) {
    case 'QUALIFIED':
    case 'CONVERTED':
    case 'TENDER_WON':
      return 'success';
    case 'TENDER_LOST':
    case 'DISQUALIFIED':
      return 'error';
    case 'TENDER_PENDING':
    case 'TENDER_ACTIVE':
      return 'warning';
    case 'INCOMING':
    case 'ASSIGNED':
    case 'IN_PROGRESS':
    case 'TENDER_SUBMITTED':
      return 'info';
  }
}

export function leadPriorityVariant(p: LeadPriority): StatusVariant {
  switch (p) {
    case 'URGENT':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'info';
    case 'LOW':
      return 'muted';
  }
}

export function slaStatusVariant(s: SLAStatus): StatusVariant {
  switch (s) {
    case 'ON_TIME':
      return 'success';
    case 'DUE_SOON':
      return 'warning';
    case 'OVERDUE':
      return 'error';
  }
}

export function govTxStatusVariant(s: GovTxStatus): StatusVariant {
  switch (s) {
    case 'APPROVED':
      return 'success';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'info';
    case 'REVISION_REQUIRED':
      return 'warning';
    case 'REJECTED':
      return 'error';
    case 'DRAFT':
    case 'CANCELLED':
      return 'muted';
  }
}

export function invoiceStatusVariant(s: InvoiceStatus): StatusVariant {
  switch (s) {
    case 'PAID':
      return 'success';
    case 'OVERDUE':
      return 'error';
    case 'PARTIALLY_PAID':
    case 'ISSUED':
      return 'warning';
    case 'CANCELLED':
    case 'REFUNDED':
    case 'DRAFT':
      return 'muted';
  }
}
