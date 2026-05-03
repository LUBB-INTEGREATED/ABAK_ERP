export const PIPELINE_STAGES = [
  'NEW_LEAD',
  'FIRST_CONTACT_MADE',
  'MEETING_SCHEDULED',
  'MEETING_DONE',
  'READY_FOR_RFQ',
  'RFQ_SUBMITTED',
  'QUOTE_IN_PREPARATION',
  'QUOTE_SENT_TO_CLIENT',
  'NEGOTIATION_REVISION',
  'WON',
  'LOST',
  'POSTPONED',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  NEW_LEAD: 'عميل جديد',
  FIRST_CONTACT_MADE: 'التواصل الأول',
  MEETING_SCHEDULED: 'اجتماع مجدول',
  MEETING_DONE: 'اجتماع منتهٍ',
  READY_FOR_RFQ: 'جاهز للطلب',
  RFQ_SUBMITTED: 'طلب تسعير مُرسَل',
  QUOTE_IN_PREPARATION: 'عرض في الإعداد',
  QUOTE_SENT_TO_CLIENT: 'عرض مُرسَل للعميل',
  NEGOTIATION_REVISION: 'تفاوض / مراجعة',
  WON: 'ربح',
  LOST: 'خسارة',
  POSTPONED: 'تأجيل',
};

export const OPEN_STAGES: PipelineStage[] = [
  'NEW_LEAD',
  'FIRST_CONTACT_MADE',
  'MEETING_SCHEDULED',
  'MEETING_DONE',
  'READY_FOR_RFQ',
  'RFQ_SUBMITTED',
  'QUOTE_IN_PREPARATION',
  'QUOTE_SENT_TO_CLIENT',
  'NEGOTIATION_REVISION',
];

export const CLOSED_STAGES: PipelineStage[] = ['WON', 'LOST', 'POSTPONED'];

export type Owner = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type PipelineLeadRef = {
  id: string;
  leadNumber: string;
  contactName: string;
  companyName: string | null;
  channel: string;
};

export type PipelineClientRef = {
  id: string;
  clientNumber: string;
  contactName: string;
  companyName: string | null;
};

export type PipelineEntry = {
  id: string;
  stage: PipelineStage;
  estimatedValue: number | null;
  probability: number | null;
  expectedCloseAt: string | null;
  stageEnteredAt: string;
  lostReason: string | null;
  postponedUntil: string | null;
  closedAt: string | null;
  owner: Owner | null;
  lead: PipelineLeadRef | null;
  client: PipelineClientRef | null;
};

export type StageStats = {
  stage: PipelineStage;
  count: number;
  estimatedValue: number;
};

export type PipelineTotals = {
  openCount: number;
  openEstimatedValue: number;
  wonCount: number;
  wonValue: number;
  closedCount: number;
  conversionRate: number;
};

export type PipelineStatsPayload = {
  stages: StageStats[];
  totals: PipelineTotals;
};
