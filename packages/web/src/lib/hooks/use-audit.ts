import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type ApiEnvelope<T> = { data: T; timestamp: string };

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditListResponse {
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
}

export interface AuditFilter {
  userId?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLogs(filter: AuditFilter = {}) {
  return useQuery<AuditListResponse>({
    queryKey: ['admin', 'audit', filter],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<AuditListResponse>>(
        '/admin/audit',
        { params: filter },
      );
      return res.data.data;
    },
  });
}
