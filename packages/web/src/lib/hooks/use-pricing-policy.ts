'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

type ApiEnvelope<T> = { data: T; timestamp: string };

export type PricingPolicyMode = 'TIERED' | 'SEQUENTIAL';
export type PricingPolicyApprover =
  | 'SALES_MANAGER'
  | 'CEO'
  | 'TECHNICAL_MANAGER'
  | 'FINANCE_MANAGER';

export type PricingPolicyTier = {
  upToPct: number;
  approver: PricingPolicyApprover;
};

export type PricingPolicySequenceItem = {
  approver: PricingPolicyApprover;
  order: number;
};

export type PricingPolicy = {
  id: string;
  salesCeilingPct: number;
  mode: PricingPolicyMode;
  tiers: PricingPolicyTier[];
  sequence: PricingPolicySequenceItem[];
  vatPct: number;
  currency: string;
  updatedAt: string;
};

export function usePricingPolicy() {
  return useQuery({
    queryKey: ['pricing-policy'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<PricingPolicy>>(
        '/admin/pricing-policy',
      );
      return data.data;
    },
  });
}

export type UpdatePricingPolicyBody = Partial<{
  salesCeilingPct: number;
  mode: PricingPolicyMode;
  tiers: PricingPolicyTier[];
  sequence: PricingPolicySequenceItem[];
  vatPct: number;
  currency: string;
}>;

export function useUpdatePricingPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdatePricingPolicyBody) => {
      const { data } = await apiClient.put<ApiEnvelope<PricingPolicy>>(
        '/admin/pricing-policy',
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing-policy'] });
    },
  });
}
