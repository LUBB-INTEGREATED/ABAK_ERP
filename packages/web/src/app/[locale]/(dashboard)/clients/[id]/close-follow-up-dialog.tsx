'use client';

import { useState } from 'react';
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
import {
  CLOSE_OUTCOMES,
  CLOSE_OUTCOME_LABELS,
  type CloseOutcome,
} from '@/lib/types/client';

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
      next.outcome = 'يجب اختيار نتيجة الإغلاق';
    }
    if (outcome === 'COMPLETED') {
      if (note.trim().length < 10) {
        next.note = 'ملاحظة الإغلاق يجب أن تكون 10 أحرف على الأقل';
      }
    }
    if (outcome === 'RESCHEDULED') {
      if (!newDueAt) {
        next.newDueAt = 'تاريخ الإعادة مطلوب';
      }
    }
    if (outcome === 'CANCELLED') {
      if (!reason.trim()) {
        next.reason = 'سبب الإلغاء مطلوب';
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
      toast.success('تم إغلاق المتابعة بنجاح');
      reset();
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'فشل إغلاق المتابعة';
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
          <DialogTitle>إغلاق المتابعة</DialogTitle>
          <DialogDescription>
            اختر نتيجة الإغلاق وأدخل التفاصيل المطلوبة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome selector */}
          <div className="space-y-2">
            <Label>
              نتيجة الإغلاق <span className="text-destructive">*</span>
            </Label>
            <Select
              value={outcome}
              onValueChange={(value) => {
                setOutcome(value as CloseOutcome);
                setErrors({});
              }}
            >
              <SelectTrigger aria-invalid={Boolean(errors.outcome)}>
                <SelectValue placeholder="اختر النتيجة" />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {CLOSE_OUTCOME_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.outcome && (
              <p className="text-xs text-destructive">{errors.outcome}</p>
            )}
          </div>

          {/* COMPLETED: outcome note (min 10 chars) */}
          {outcome === 'COMPLETED' && (
            <div className="space-y-2">
              <Label htmlFor="note">
                ملاحظة النتيجة <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب ملاحظات تفصيلية عن نتيجة المتابعة (10 أحرف على الأقل)"
                aria-invalid={Boolean(errors.note)}
              />
              <p className="text-xs text-muted-foreground">
                {note.trim().length} / 10 أحرف
              </p>
              {errors.note && (
                <p className="text-xs text-destructive">{errors.note}</p>
              )}
            </div>
          )}

          {/* RESCHEDULED: new due date */}
          {outcome === 'RESCHEDULED' && (
            <div className="space-y-2">
              <Label htmlFor="newDueAt">
                تاريخ الإعادة <span className="text-destructive">*</span>
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

          {/* CANCELLED: reason */}
          {outcome === 'CANCELLED' && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                سبب الإلغاء <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبب إلغاء هذه المتابعة"
                aria-invalid={Boolean(errors.reason)}
              />
              {errors.reason && (
                <p className="text-xs text-destructive">{errors.reason}</p>
              )}
            </div>
          )}

          {/* CLIENT_NOT_REACHABLE: informational note */}
          {outcome === 'CLIENT_NOT_REACHABLE' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              سيتم إنشاء متابعة جديدة تلقائياً بعد 3 أيام.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !outcome}>
            {mutation.isPending ? 'جاري الإغلاق…' : 'تأكيد الإغلاق'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
