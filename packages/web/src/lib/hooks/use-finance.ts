import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  CommercialConfirmation,
  FinanceStats,
  Invoice,
  InvoiceListResponse,
  InvoiceStatus,
  Payment,
  PaymentListResponse,
  PaymentMethod,
  PaymentValidationStatus,
} from '@/lib/types/finance';

type ApiEnvelope<T> = { data: T; timestamp: string };

const FINANCE_QK = ['finance'] as const;

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: FINANCE_QK });
  qc.invalidateQueries({ queryKey: ['projects'] });
  qc.invalidateQueries({ queryKey: ['quotes'] });
}

export function useFinanceStats() {
  return useQuery<FinanceStats>({
    queryKey: [...FINANCE_QK, 'stats'],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<FinanceStats>>('/finance/stats');
      return res.data.data;
    },
  });
}

export function useCommercialConfirmations(status?: PaymentValidationStatus) {
  return useQuery<CommercialConfirmation[]>({
    queryKey: [...FINANCE_QK, 'commercial', status ?? 'all'],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<CommercialConfirmation[]>>(
        '/finance/commercial-confirmations',
        { params: status ? { status } : undefined },
      );
      return res.data.data;
    },
  });
}

export function useValidateCommercialConfirmation() {
  const qc = useQueryClient();
  return useMutation<
    CommercialConfirmation,
    unknown,
    { id: string; status: PaymentValidationStatus; note?: string }
  >({
    mutationFn: async ({ id, ...body }) => {
      const res = await apiClient.patch<ApiEnvelope<CommercialConfirmation>>(
        `/finance/commercial-confirmations/${id}/validate`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useInvoices(
  params: {
    status?: InvoiceStatus;
    clientId?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  return useQuery<InvoiceListResponse>({
    queryKey: [...FINANCE_QK, 'invoices', params],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<InvoiceListResponse>>(
        '/finance/invoices',
        { params },
      );
      return res.data.data;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation<
    Invoice,
    unknown,
    {
      poId: string;
      dueDate: string;
      subtotal: number;
      taxAmount: number;
      projectId?: string;
    }
  >({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<Invoice>>(
        '/finance/invoices',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function usePayments(
  params: {
    validationStatus?: PaymentValidationStatus;
    page?: number;
    pageSize?: number;
  } = {},
) {
  return useQuery<PaymentListResponse>({
    queryKey: [...FINANCE_QK, 'payments', params],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PaymentListResponse>>(
        '/finance/payments',
        { params },
      );
      return res.data.data;
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation<
    Payment,
    unknown,
    {
      poId: string;
      invoiceId?: string;
      amount: number;
      method: PaymentMethod;
      receivedAt: string;
      referenceNumber?: string;
      docUrl?: string;
    }
  >({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<Payment>>(
        '/finance/payments',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useValidatePayment() {
  const qc = useQueryClient();
  return useMutation<
    Payment,
    unknown,
    { id: string; status: PaymentValidationStatus; note?: string }
  >({
    mutationFn: async ({ id, ...body }) => {
      const res = await apiClient.patch<ApiEnvelope<Payment>>(
        `/finance/payments/${id}/validate`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
