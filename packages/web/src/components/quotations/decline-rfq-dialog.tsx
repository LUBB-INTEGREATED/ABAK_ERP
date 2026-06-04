'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDeclineRfq } from '@/lib/hooks/use-rfqs';
import type { RfqDeclineType, RfqListItem } from '@/lib/types/rfq';
import { cn } from '@/lib/utils';

// QP-4 — "Not us / decline". Reason is required (a documented decline routes
// work back to sales). WRONG_DEPT → sales gets a re-route affordance (SALES-5);
// NO_BID → terminal, the mandatory note is the documented reason. Confirm is the
// destructive button, disabled until the reason note is present.

export function DeclineRfqDialog({
  rfq,
  open,
  onClose,
}: {
  rfq: RfqListItem;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('quotations.decline');
  const decline = useDeclineRfq(rfq.id);

  const [type, setType] = useState<RfqDeclineType>('WRONG_DEPT');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfirm = reason.trim().length > 0 && !busy;

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await decline.mutateAsync({ type, reason: reason.trim() });
      toast.success(t('toastSuccess', { rfq: rfq.rfqNumber }));
      onClose();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('toastFailed');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            <span className="font-mono" dir="ltr">
              {rfq.rfqNumber}
            </span>{' '}
            · {rfq.client?.companyName ?? rfq.client?.contactName ?? '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('reasonLabel')}</legend>
            {(['WRONG_DEPT', 'NO_BID'] as RfqDeclineType[]).map((opt) => (
              <label
                key={opt}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 text-sm',
                  type === opt ? 'border-abak-blue bg-abak-blue/5' : '',
                )}
              >
                <input
                  type="radio"
                  name="declineType"
                  checked={type === opt}
                  onChange={() => setType(opt)}
                  disabled={busy}
                  className="h-4 w-4"
                />
                {t(`type.${opt}`)}
              </label>
            ))}
          </fieldset>

          <label className="block space-y-1">
            <span className="text-sm font-medium">
              {type === 'NO_BID' ? t('noteLabelNoBid') : t('noteLabel')}
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('notePlaceholder')}
              rows={3}
              dir="auto"
              disabled={busy}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] rounded-md border px-4 text-sm font-medium hover:bg-muted/40"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('confirm')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
