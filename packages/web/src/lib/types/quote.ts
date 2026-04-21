export const QUOTE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'VIEWED',
  'UNDER_NEGOTIATION',
  'REVISED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  UNDER_NEGOTIATION: 'Under negotiation',
  REVISED: 'Revised',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

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
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
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
