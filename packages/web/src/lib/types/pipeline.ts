export const PIPELINE_STAGES = [
  'NEW_LEAD',
  'INITIAL_CONTACT',
  'QUALIFICATION',
  'RFQ_RECEIVED',
  'QUOTE_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
  'POSTPONED',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  NEW_LEAD: 'New lead',
  INITIAL_CONTACT: 'Initial contact',
  QUALIFICATION: 'Qualification',
  RFQ_RECEIVED: 'RFQ received',
  QUOTE_SENT: 'Quote sent',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
  POSTPONED: 'Postponed',
};

export const OPEN_STAGES: PipelineStage[] = [
  'NEW_LEAD',
  'INITIAL_CONTACT',
  'QUALIFICATION',
  'RFQ_RECEIVED',
  'QUOTE_SENT',
  'NEGOTIATION',
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
