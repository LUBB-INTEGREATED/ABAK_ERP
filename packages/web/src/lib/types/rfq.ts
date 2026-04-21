export type RfqStatus =
  | 'RECEIVED'
  | 'ASSIGNED'
  | 'IN_PREPARATION'
  | 'PENDING_APPROVAL'
  | 'APPROVED_READY_FOR_DISPATCH'
  | 'SENT'
  | 'WON'
  | 'LOST'
  | 'POSTPONED'
  | 'CANCELLED';

export type RfqPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export type RfqSource =
  | 'SALES_MANAGER'
  | 'INTERNAL_REP'
  | 'BROKER'
  | 'SOCIAL'
  | 'EMAIL'
  | 'WHATSAPP';

export type RfqDispatchChannel = 'WHATSAPP' | 'EMAIL';

export type ConfirmationType = 'PAYMENT' | 'PO' | 'CONTRACT';

export interface RfqUserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
}

export interface RfqListItem {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  priority: RfqPriority;
  requestedByChannel: RfqSource;
  serviceType: string;
  createdAt: string;
  coordinatorAssignedAt: string | null;
  client: {
    id: string;
    contactName: string;
    companyName: string | null;
  } | null;
  coordinator: RfqUserSummary | null;
}

export interface RfqDetail extends RfqListItem {
  projectScope: string;
  brokerName: string | null;
  brokerPhone: string | null;
  coordinator: RfqUserSummary | null;
  technicalContributor: RfqUserSummary | null;
  financialReviewer: RfqUserSummary | null;
  originalSalesRep: RfqUserSummary | null;
  opportunityId: string;
  quoteId: string | null;
  quote: {
    id: string;
    quoteNumber: string;
    status: string;
    totalAmount: number;
    version: number;
    sentAt: string | null;
  } | null;
  dispatchedAt: string | null;
  dispatchedVia: RfqDispatchChannel | null;
  confirmationType: ConfirmationType | null;
  confirmationAt: string | null;
  confirmationValue: number | null;
  confirmationDocUrl: string | null;
  lostReason: string | null;
  postponedUntil: string | null;
}

export interface RfqListResponse {
  data: RfqListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}
