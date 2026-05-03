export const QUOTE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'IN_REVISION',
  'APPROVED',
  'SENT',
  'IN_DISCUSSION',
  'IN_NEGOTIATION',
  'REVISED',
  'WON',
  'LOST',
  'POSTPONED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  PENDING_APPROVAL: 'Pending approval',
  IN_REVISION: 'In revision',
  APPROVED: 'Approved',
  SENT: 'Sent',
  IN_DISCUSSION: 'In discussion',
  IN_NEGOTIATION: 'In negotiation',
  REVISED: 'Revised',
  WON: 'Won',
  LOST: 'Lost',
  POSTPONED: 'Postponed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const LOSS_REASONS = [
  'PRICE',
  'COMPETITOR',
  'SCOPE_MISMATCH',
  'BUDGET_UNAVAILABLE',
  'POSTPONED',
  'NO_RESPONSE',
  'QUALITY_CONCERN',
  'INTERNAL',
  'OTHER',
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export type QuoteItem = {
  id: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPct: number;
  subtotal: number;
  notes: string | null;
  position: number;
};

export type PaymentMilestone = {
  id: string;
  description: string;
  percentage: number;
  amount: number;
  daysFromStart: number | null;
  notes: string | null;
  position: number;
};

export type QuoteApproval = {
  id: string;
  tier: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments: string | null;
  decidedAt: string | null;
  approver: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
  };
};

export type PurchaseOrderRef = {
  id: string;
  poNumber: string;
  contractValue: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  poDate: string;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  version: number;
  status: QuoteStatus;
  title: string;
  description: string | null;
  validUntil: string | null;
  deliveryTimeline: string | null;
  paymentTerms: string | null;
  termsAndConditions: string | null;
  internalNotes: string | null;
  clientNotes: string | null;
  subtotal: number;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  sentAt: string | null;
  viewedAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReasonCode: LossReason | null;
  lostReason: string | null;
  postponedUntil: string | null;
  cancelledAt: string | null;
  parentQuoteId: string | null;
  createdAt: string;
  // Technical Scope (BPD M4)
  scopeOfWork: string | null;
  deliverables: string | null;
  exclusions: string | null;
  assumptions: string | null;
  numberOfRevisions: number | null;
  client: {
    id: string;
    clientNumber: string;
    contactName: string;
    companyName: string | null;
  };
  preparedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  items: QuoteItem[];
  paymentMilestones: PaymentMilestone[];
  approvals: QuoteApproval[];
  purchaseOrder: PurchaseOrderRef | null;
};
