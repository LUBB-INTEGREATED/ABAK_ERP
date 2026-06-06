// LeadChannel list updated 2026-05-21: GOVERNMENT_TENDER removed (government
// work is now licences inside projects, see Licence model). Added PHONE,
// EXISTING_CLIENT_REPEAT, and OTHER as new active channels. AI_CHATBOT kept
// for future chatbot integration. See docs/CORRECTED_CLIENT_JOURNEY.md §A.
export const LEAD_CHANNELS = [
  'REFERRAL',
  'WALK_IN',
  'PHONE',
  'EXISTING_CLIENT_REPEAT',
  'SOCIAL_MEDIA',
  'WEBSITE',
  'GOOGLE_MAPS',
  'AI_CHATBOT',
  'OTHER',
] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

// LEAD_STATUSES: the tender-specific statuses are deprecated as of 2026-05-21
// (no government tender channel). Kept temporarily for backward compatibility
// with any in-flight records; new leads won't enter these states.
export const LEAD_STATUSES = [
  'INCOMING',
  'ASSIGNED',
  'IN_PROGRESS',
  'QUALIFIED',
  'CONVERTED',
  'DISQUALIFIED',
  'TENDER_PENDING',
  'TENDER_ACTIVE',
  'TENDER_SUBMITTED',
  'TENDER_WON',
  'TENDER_LOST',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const SLA_STATUSES = ['ON_TIME', 'DUE_SOON', 'OVERDUE'] as const;
export type SLAStatus = (typeof SLA_STATUSES)[number];

export type LeadAssignee = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type LeadService = {
  id: string;
  name: string;
  code: string;
};

export type Lead = {
  id: string;
  leadNumber: string;
  channel: LeadChannel;
  source: string | null;
  referenceNumber: string | null;
  contactName: string;
  companyName: string | null;
  email: string | null;
  phone: string;
  alternatePhone: string | null;
  serviceId: string | null;
  service: LeadService | null;
  serviceDetails: string | null;
  projectLocation: string | null;
  city: string | null;
  district: string | null;
  projectSize: string | null;
  budget: number | null;
  timeline: string | null;
  etimadNumber: string | null;
  fursaNumber: string | null;
  tenderDeadline: string | null;
  tenderDetails: Record<string, unknown> | null;
  referredBy: string | null;
  referrerPhone: string | null;
  referrerCompany: string | null;
  socialPlatform: string | null;
  socialProfile: string | null;
  mapsLink: string | null;
  mapsReview: boolean | null;
  status: LeadStatus;
  priority: LeadPriority;
  slaStatus: SLAStatus;
  slaResponseDue: string | null;
  firstResponseAt: string | null;
  assignedToId: string | null;
  assignedTo: LeadAssignee | null;
  assignedAt: string | null;
  isReturningClient: boolean;
  clientId: string | null;
  qualificationScore: number | null;
  qualificationNotes: string | null;
  initialNotes: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  deletedAt: string | null;
};

export type Paginated<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type LeadFilter = {
  channel?: LeadChannel;
  status?: LeadStatus;
  priority?: LeadPriority;
  slaStatus?: SLAStatus;
  assignedToId?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  REFERRAL: 'Referral',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone',
  EXISTING_CLIENT_REPEAT: 'Existing client (repeat)',
  SOCIAL_MEDIA: 'Social media',
  WEBSITE: 'Website',
  GOOGLE_MAPS: 'Google Maps',
  AI_CHATBOT: 'AI chatbot',
  OTHER: 'Other',
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  INCOMING: 'وارد جديد',
  ASSIGNED: 'مُعيَّن',
  IN_PROGRESS: 'قيد المتابعة',
  QUALIFIED: 'مؤهَّل',
  CONVERTED: 'تم تحويله لعميل',
  DISQUALIFIED: 'غير مؤهل',
  TENDER_PENDING: 'مناقصة - انتظار',
  TENDER_ACTIVE: 'مناقصة نشطة',
  TENDER_SUBMITTED: 'مناقصة مُقدَّمة',
  TENDER_WON: 'مناقصة رابحة',
  TENDER_LOST: 'مناقصة خاسرة',
};

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const SLA_LABELS: Record<SLAStatus, string> = {
  ON_TIME: 'On time',
  DUE_SOON: 'Due soon',
  OVERDUE: 'Overdue',
};
