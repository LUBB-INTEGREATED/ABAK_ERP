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

export const STATUS_BADGE: Record<LeadStatus, string> = {
  INCOMING: 'bg-sky-100 text-sky-700',
  ASSIGNED: 'bg-abak-blue/10 text-abak-blue',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  QUALIFIED: 'bg-abak-gold/15 text-abak-gold',
  DISQUALIFIED: 'bg-zinc-100 text-zinc-600',
  TENDER_PENDING: 'bg-purple-100 text-purple-700',
  TENDER_ACTIVE: 'bg-blue-100 text-blue-700',
  TENDER_SUBMITTED: 'bg-cyan-100 text-cyan-700',
  TENDER_WON: 'bg-emerald-100 text-emerald-700',
  TENDER_LOST: 'bg-rose-100 text-rose-700',
};

export const SLA_BADGE: Record<SLAStatus, string> = {
  ON_TIME: 'bg-emerald-100 text-emerald-700',
  DUE_SOON: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
};

export const PRIORITY_BADGE: Record<LeadPriority, string> = {
  LOW: 'bg-zinc-100 text-zinc-600',
  MEDIUM: 'bg-sky-100 text-sky-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-rose-100 text-rose-700',
};

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
