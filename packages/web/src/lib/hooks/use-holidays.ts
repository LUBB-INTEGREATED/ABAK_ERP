import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface PublicHoliday {
  id: string;
  date: string;
  nameAr: string;
  nameEn: string;
  isRecurring: boolean;
  notes: string | null;
}

export interface HolidayInput {
  date: string;
  nameAr: string;
  nameEn: string;
  isRecurring?: boolean;
  notes?: string;
}

type ApiEnvelope<T> = { data: T; timestamp: string };

const QK = ['holidays'] as const;

export function useHolidays() {
  return useQuery<PublicHoliday[]>({
    queryKey: QK,
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<PublicHoliday[]>>('/holidays');
      return res.data.data;
    },
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation<PublicHoliday, unknown, HolidayInput>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<ApiEnvelope<PublicHoliday>>(
        '/holidays',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string }>({
    mutationFn: async ({ id }) => {
      await apiClient.delete(`/holidays/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
