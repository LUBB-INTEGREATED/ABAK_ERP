export const CLIENT_CLASSIFICATIONS = [
  'NEW',
  'RETURNING',
  'VIP',
  'DORMANT',
  'ARCHIVED',
] as const;
export type ClientClassification = (typeof CLIENT_CLASSIFICATIONS)[number];

export const CLIENT_STATUSES = ['ACTIVE', 'INACTIVE', 'BLACKLISTED'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const INTERACTION_TYPES = [
  'PHONE_CALL',
  'MEETING',
  'EMAIL',
  'WHATSAPP',
  'COMPLAINT',
  'SITE_VISIT',
  'NEGOTIATION',
  'TECHNICAL_CONSULTATION',
  'PROPOSAL_SUBMISSION',
  'INTERNAL_NOTE',
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];

export const FOLLOW_UP_TYPES = [
  'GENERAL',
  'QUOTE',
  'PAYMENT',
  'PROJECT_MILESTONE',
  'SATISFACTION_SURVEY',
  'RENEWAL',
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE',
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const NOTE_TAGS = [
  'GENERAL',
  'IMPORTANT',
  'ISSUE',
  'OPPORTUNITY',
] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

export const CLASSIFICATION_LABELS: Record<ClientClassification, string> = {
  NEW: 'New',
  RETURNING: 'Returning',
  VIP: 'VIP',
  DORMANT: 'Dormant',
  ARCHIVED: 'Archived',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  BLACKLISTED: 'Blacklisted',
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  PHONE_CALL: 'Phone call',
  MEETING: 'Meeting',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  COMPLAINT: 'Complaint',
  SITE_VISIT: 'Site visit',
  NEGOTIATION: 'Negotiation',
  TECHNICAL_CONSULTATION: 'Technical consult',
  PROPOSAL_SUBMISSION: 'Proposal',
  INTERNAL_NOTE: 'Internal note',
};

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  GENERAL: 'General',
  QUOTE: 'Quote',
  PAYMENT: 'Payment',
  PROJECT_MILESTONE: 'Project milestone',
  SATISFACTION_SURVEY: 'Satisfaction survey',
  RENEWAL: 'Renewal',
};

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  OVERDUE: 'Overdue',
};

export const NOTE_TAG_LABELS: Record<NoteTag, string> = {
  GENERAL: 'General',
  IMPORTANT: 'Important',
  ISSUE: 'Issue',
  OPPORTUNITY: 'Opportunity',
};

export type AccountManager = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type Client = {
  id: string;
  clientNumber: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  phone: string;
  alternatePhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  commercialRegistration: string | null;
  taxId: string | null;
  classification: ClientClassification;
  classificationManual: boolean;
  status: ClientStatus;
  creditLimit: number | null;
  paymentTerms: string | null;
  accountManagerId: string | null;
  accountManager: AccountManager | null;
  lifetimeValue: number;
  satisfactionScore: number | null;
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count?: {
    interactions: number;
    followUps: number;
    leads: number;
    notes?: number;
  };
};

export type Interaction = {
  id: string;
  clientId: string;
  type: InteractionType;
  direction: InteractionDirection | null;
  subject: string;
  summary: string | null;
  location: string | null;
  outcome: string | null;
  nextAction: string | null;
  durationMinutes: number | null;
  occurredAt: string;
  author: AccountManager | null;
  createdAt: string;
};

export type FollowUp = {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  type: FollowUpType;
  status: FollowUpStatus;
  dueAt: string;
  completedAt: string | null;
  outcome: string | null;
  assignedTo: AccountManager | null;
  assignedToId: string | null;
};

export type ClientNote = {
  id: string;
  clientId: string;
  body: string;
  tag: NoteTag;
  author: AccountManager | null;
  createdAt: string;
};

export type ClientFilter = {
  classification?: ClientClassification;
  status?: ClientStatus;
  accountManagerId?: string;
  city?: string;
  region?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};
