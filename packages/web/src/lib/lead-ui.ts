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
  NEW: 'bg-sky-100 text-sky-700',
  ASSIGNED: 'bg-abak-blue/10 text-abak-blue',
  CONTACTED: 'bg-indigo-100 text-indigo-700',
  QUALIFIED: 'bg-abak-gold/15 text-abak-gold',
  UNQUALIFIED: 'bg-zinc-100 text-zinc-600',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-rose-100 text-rose-700',
  DUPLICATE: 'bg-amber-100 text-amber-700',
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
  'CONVERTED',
  'LOST',
  'DUPLICATE',
];

export function getAllowedNextStatuses(from: LeadStatus): LeadStatus[] {
  switch (from) {
    case 'NEW':
      return ['ASSIGNED', 'CONTACTED', 'UNQUALIFIED', 'DUPLICATE'];
    case 'ASSIGNED':
      return ['CONTACTED', 'UNQUALIFIED', 'LOST', 'DUPLICATE'];
    case 'CONTACTED':
      return ['QUALIFIED', 'UNQUALIFIED', 'LOST', 'DUPLICATE'];
    case 'QUALIFIED':
      return ['CONVERTED', 'LOST', 'UNQUALIFIED'];
    case 'UNQUALIFIED':
      return ['QUALIFIED'];
    default:
      return [];
  }
}

export function statusRequiresReason(status: LeadStatus): boolean {
  return status === 'LOST' || status === 'UNQUALIFIED';
}

export {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CHANNEL_LABELS,
  SLA_LABELS,
  LEAD_STATUSES,
};
export type { LeadChannel, LeadPriority, LeadStatus, SLAStatus };
