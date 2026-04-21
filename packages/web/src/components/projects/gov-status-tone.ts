import type { GovTxStatus } from '@/lib/types/gov';

export const GOV_TONE: Record<
  GovTxStatus,
  'slate' | 'sky' | 'amber' | 'emerald' | 'rose' | 'zinc' | 'zinc-dark'
> = {
  DRAFT: 'slate',
  SUBMITTED: 'sky',
  UNDER_REVIEW: 'amber',
  REVISION_REQUIRED: 'amber',
  APPROVED: 'emerald',
  REJECTED: 'rose',
  CANCELLED: 'zinc-dark',
};
