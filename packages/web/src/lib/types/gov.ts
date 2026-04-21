export type GovTxStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type GovAuthorityCategory =
  | 'MUNICIPALITY'
  | 'MINISTRY'
  | 'UTILITY'
  | 'PLATFORM_ETIMAD'
  | 'PLATFORM_FURSA'
  | 'OTHER';

export interface UserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string;
}

export interface GovVisit {
  id: string;
  transactionId: string;
  visitedAt: string;
  purpose: string;
  outcome: string | null;
  nextAction: string | null;
  latitude: number | null;
  longitude: number | null;
  visitedBy: UserSummary;
}

export interface GovComment {
  id: string;
  transactionId: string;
  commentText: string;
  issuedAt: string;
  responseText: string | null;
  respondedAt: string | null;
  respondedBy: UserSummary | null;
}

export interface GovDocument {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  uploadedAt: string;
}

export interface GovTransactionListItem {
  id: string;
  transactionNumber: string;
  authorityName: string;
  authorityCategory: GovAuthorityCategory;
  transactionType: string;
  status: GovTxStatus;
  expectedResponseAt: string | null;
  submittedAt: string | null;
  weeklyStatusLastAt: string | null;
  project: { id: string; projectNumber: string; title: string };
  assignedPro: UserSummary | null;
  _count?: { visits: number; comments: number; documents: number };
}

export interface GovTransactionDetail extends GovTransactionListItem {
  referenceNumber: string | null;
  fees: number | null;
  feesPaid: boolean;
  resolvedAt: string | null;
  assignedEngineer: UserSummary | null;
  visits: GovVisit[];
  comments: GovComment[];
  documents: GovDocument[];
}

export interface GovTransactionListResponse {
  data: GovTransactionListItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export interface GovStats {
  total: number;
  byStatus: { status: GovTxStatus; count: number }[];
  unloggedWeekly: number;
  awaitingResponse: number;
}

export interface ProDashboard {
  open: GovTransactionListItem[];
  visitsToday: (GovVisit & {
    transaction: {
      id: string;
      transactionNumber: string;
      authorityName: string;
    };
  })[];
}
