import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { UpdateProfilePayload, UserProfile } from '@/lib/types/profile';

type ApiEnvelope<T> = { data: T; timestamp: string };

const QK = ['me', 'profile'] as const;

export function useMyProfile() {
  return useQuery<UserProfile>({
    queryKey: QK,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<UserProfile>>('/users/me');
      return res.data.data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<UserProfile, unknown, UpdateProfilePayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.patch<ApiEnvelope<UserProfile>>(
        '/users/me',
        payload,
      );
      return res.data.data;
    },
    onSuccess: (profile) => {
      qc.setQueryData(QK, profile);
    },
  });
}
