import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type ApiEnvelope<T> = { data: T; timestamp: string };

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  recipientId: string;
  eventCode: string;
  subject: string;
  body: string;
  locale: string;
  priority: NotificationPriority;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}

const QK = ['notifications'] as const;

export function useNotifications(unreadOnly = false, limit = 20) {
  return useQuery<Notification[]>({
    queryKey: [...QK, 'list', { unreadOnly, limit }],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Notification[]>>(
        '/notifications',
        { params: { unreadOnly: unreadOnly ? 'true' : undefined, limit } },
      );
      return res.data.data;
    },
  });
}

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: [...QK, 'unread-count'],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<number>>(
        '/notifications/unread-count',
      );
      return res.data.data;
    },
    refetchInterval: 60_000, // poll every minute
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<Notification, unknown, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiClient.patch<ApiEnvelope<Notification>>(
        `/notifications/${id}/mark-read`,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/mark-all-read');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
