import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { SettingHistoryEntry, SystemSetting } from '@/lib/types/settings';

const QK = ['admin', 'settings'] as const;

export function useSettings() {
  return useQuery<SystemSetting[]>({
    queryKey: QK,
    queryFn: async () => {
      const res = await apiClient.get<SystemSetting[]>('/admin/settings');
      return res.data;
    },
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation<SystemSetting, unknown, { key: string; value: string }>({
    mutationFn: async ({ key, value }) => {
      const res = await apiClient.patch<SystemSetting>(
        `/admin/settings/${key}`,
        { value },
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useResetSetting() {
  const qc = useQueryClient();
  return useMutation<SystemSetting, unknown, { key: string }>({
    mutationFn: async ({ key }) => {
      const res = await apiClient.post<SystemSetting>(
        `/admin/settings/${key}/reset`,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useSettingHistory(key: string | null) {
  return useQuery<SettingHistoryEntry[]>({
    queryKey: ['admin', 'settings', 'history', key],
    enabled: !!key,
    queryFn: async () => {
      const res = await apiClient.get<SettingHistoryEntry[]>(
        `/admin/settings/${key}/history`,
      );
      return res.data;
    },
  });
}
