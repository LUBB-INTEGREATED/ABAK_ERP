import {
  CHANNEL_LABELS,
  LEAD_STATUSES,
  PRIORITY_LABELS,
  SLA_LABELS,
  STATUS_LABELS,
  type LeadChannel,
  type LeadPriority,
  type LeadStatus,
  type SLAStatus,
} from './types/lead';

// STATUS_BADGE / SLA_BADGE / PRIORITY_BADGE removed — use
// LeadStatusBadge / SlaStatusBadge / LeadPriorityBadge from
// '@/components/ui/entity-status-badges' instead. See DESIGN_SYSTEM_MASTER.md §2.

export const TERMINAL_STATUSES: LeadStatus[] = [
  'DISQUALIFIED',
  'TENDER_WON',
  'TENDER_LOST',
];

export function getAllowedNextStatuses(from: LeadStatus): LeadStatus[] {
  switch (from) {
    case 'INCOMING':
      return ['ASSIGNED', 'IN_PROGRESS', 'DISQUALIFIED'];
    case 'ASSIGNED':
      return ['IN_PROGRESS', 'DISQUALIFIED'];
    case 'IN_PROGRESS':
      return ['QUALIFIED', 'DISQUALIFIED'];
    case 'QUALIFIED':
      return ['DISQUALIFIED'];
    case 'DISQUALIFIED':
      return ['QUALIFIED'];
    case 'TENDER_PENDING':
      return ['TENDER_ACTIVE', 'TENDER_LOST'];
    case 'TENDER_ACTIVE':
      return ['TENDER_SUBMITTED', 'TENDER_LOST'];
    case 'TENDER_SUBMITTED':
      return ['TENDER_WON', 'TENDER_LOST'];
    default:
      return [];
  }
}

export function statusRequiresReason(status: LeadStatus): boolean {
  return status === 'DISQUALIFIED' || status === 'TENDER_LOST';
}

export {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CHANNEL_LABELS,
  SLA_LABELS,
  LEAD_STATUSES,
};
export type { LeadChannel, LeadPriority, LeadStatus, SLAStatus };
