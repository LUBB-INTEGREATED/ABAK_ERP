'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCloseFollowUp } from '@/lib/hooks/use-clients';
import { CLOSE_OUTCOMES, type CloseOutcome } from '@/lib/types/client';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

export function CloseFollowUpDialog({
  open,
  onOpenChange,
  followUpId,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUpId: string;
  clientId: string;
}) {
  const t = useTranslations('clients.closeFollowUpDialog');
  const outcomeLabel = useEnumLabel('closeOutcome');
  const [outcome, setOutcome] = useState<CloseOutcome | ''>('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [newDueAt, setNewDueAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useCloseFollowUp(clientId);

  function reset() {
    setOutcome('');
    setNote('');
    setReason('');
    setNewDueAt('');
    setErrors({});
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!outcome) {
      next.outcome = t('outcomeRequired');
    }
    if (outcome === 'COMPLETED') {
      if (note.trim().length < 10) {
        next.note = t('noteMinLength');
      }
    }
    if (outcome === 'RESCHEDULED') {
      if (!newDueAt) {
        next.newDueAt = t('newDueRequired');
      }
    }
    if (outcome === 'CANCELLED') {
      if (!reason.trim()) {
        next.reason = t('cancelReasonRequired');
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;

    try {
      await mutation.mutateAsync({
        id: followUpId,
        closureOutcome: outcome as CloseOutcome,
        outcome: note.trim() || undefined,
        newDueAt: newDueAt ? new Date(newDueAt).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });
      toast.success(t('closed'));
      reset();
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('closeFailed');
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('notePlaceholder')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              {t('outcome')} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={outcome}
              onValueChange={(value) => {
                setOutcome(value as CloseOutcome);
                setErrors({});
              }}
            >
              <SelectTrigger aria-invalid={Boolean(errors.outcome)}>
                <SelectValue placeholder={t('selectOutcome')} />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {outcomeLabel(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.outcome && (
              <p className="text-xs text-destructive">{errors.outcome}</p>
            )}
          </div>

          {outcome === 'COMPLETED' && (
            <div className="space-y-2">
              <Label htmlFor="note">
                {t('note')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                aria-invalid={Boolean(errors.note)}
              />
              <p className="text-xs text-muted-foreground">
                {note.trim().length} / 10
              </p>
              {errors.note && (
                <p className="text-xs text-destructive">{errors.note}</p>
              )}
            </div>
          )}

          {outcome === 'RESCHEDULED' && (
            <div className="space-y-2">
              <Label htmlFor="newDueAt">
                {t('newDueAt')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newDueAt"
                type="datetime-local"
                value={newDueAt}
                onChange={(e) => setNewDueAt(e.target.value)}
                aria-invalid={Boolean(errors.newDueAt)}
              />
              {errors.newDueAt && (
                <p className="text-xs text-destructive">{errors.newDueAt}</p>
              )}
            </div>
          )}

          {outcome === 'CANCELLED' && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                {t('cancelReason')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('cancelReasonPlaceholder')}
                aria-invalid={Boolean(errors.reason)}
              />
              {errors.reason && (
                <p className="text-xs text-destructive">{errors.reason}</p>
              )}
            </div>
          )}

          {outcome === 'CLIENT_NOT_REACHABLE' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {t('autoRescheduleHint')}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !outcome}>
            {mutation.isPending ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
