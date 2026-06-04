// Thin RFQ (DM-1). The RFQ only carries intake states; everything past the seam
// is derived by the API from the linked quote (deriveRfqDisplayStatus).
export type RfqStatus =
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'PRICING'
  | 'CANCELLED'
  | 'DECLINED';

// The sales-facing status the API computes (DM-2). The client renders this; it
// does NOT recompute lifecycle from the quote.
export type RfqDisplayStatus =
  | 'SUBMITTED'
  | 'DECLINED_WRONG_DEPT'
  | 'DECLINED_NO_BID'
  | 'CANCELLED'
  | 'PRICING'
  | 'IN_APPROVAL'
  | 'QUOTE_READY'
  | 'SENT'
  | 'WON'
  | 'LOST'
  | 'POSTPONED';

export type RfqDeclineType = 'WRONG_DEPT' | 'NO_BID';

export type RfqPriority = 'NORMAL' | 'HIGH' | 'URGENT';

export type RfqSource =
  | 'SALES_MANAGER'
  | 'INTERNAL_REP'
  | 'BROKER'
  | 'SOCIAL'
  | 'EMAIL'
  | 'WHATSAPP';

export interface RfqUserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
}

export interface RfqQuoteSummary {
  id: string;
  quoteNumber: string;
  status: string;
  totalAmount: number;
  version: number;
  sentAt: string | null;
}

export interface RfqListItem {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  displayStatus: RfqDisplayStatus;
  priority: RfqPriority;
  requestedByChannel: RfqSource;
  serviceType: string;
  createdAt: string;
  // SALES-1: count of PENDING doc + site-visit requests owed by the rep.
  openAskCount: number;
  client: {
    id: string;
    contactName: string;
    companyName: string | null;
  } | null;
  quote: RfqQuoteSummary | null;
}

export interface RfqDetail extends RfqListItem {
  projectScope: string;
  brokerName: string | null;
  brokerPhone: string | null;
  originalSalesRep: RfqUserSummary | null;
  opportunityId: string;
  requestedCategoryIds: string[];
  quoteId: string | null;
  declineType: RfqDeclineType | null;
  declineReason: string | null;
  createdBy: string | null;
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
