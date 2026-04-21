export type PaymentValidationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';
export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CASH'
  | 'ONLINE'
  | 'OTHER';
export type ConfirmationType = 'PAYMENT' | 'PO' | 'CONTRACT';
export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';

export interface ClientSummary {
  id: string;
  contactName: string;
  companyName: string | null;
}

export interface CommercialConfirmation {
  id: string;
  quoteId: string;
  type: ConfirmationType;
  confirmedAt: string;
  contractValue: number;
  docUrl: string | null;
  notes: string | null;
  validationStatus: PaymentValidationStatus;
  validatedAt: string | null;
  validationNote: string | null;
  createdAt: string;
  quote: {
    id: string;
    quoteNumber: string;
    title: string;
    totalAmount: number;
    client: ClientSummary;
  };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  poId: string;
  clientId: string;
  projectId: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  client: ClientSummary;
  po: { id: string; poNumber: string };
  _count?: { payments: number };
}

export interface Payment {
  id: string;
  paymentNumber: string;
  poId: string;
  invoiceId: string | null;
  clientId: string;
  receivedAt: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string | null;
  docUrl: string | null;
  validationStatus: PaymentValidationStatus;
  validatedAt: string | null;
  validationNote: string | null;
  client: ClientSummary;
  po: { id: string; poNumber: string; contractValue: number };
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  } | null;
}

export interface FinanceStats {
  pendingConfirmations: number;
  pendingPayments: number;
  overdueInvoices: number;
  totalCollected: number;
}

export interface InvoiceListResponse {
  data: Invoice[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export interface PaymentListResponse {
  data: Payment[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}
