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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateLeadStatus } from '@/lib/hooks/use-leads';
import {
  STATUS_LABELS,
  getAllowedNextStatuses,
  statusRequiresReason,
} from '@/lib/lead-ui';
import type { LeadStatus } from '@/lib/types/lead';

export function StatusDialog({
  open,
  onOpenChange,
  leadId,
  currentStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentStatus: LeadStatus;
}) {
  const allowed = getAllowedNextStatuses(currentStatus);
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [reason, setReason] = useState('');
  const mutation = useUpdateLeadStatus(leadId);

  const needsReason = status ? statusRequiresReason(status) : false;
  const canSubmit =
    Boolean(status) && (!needsReason || reason.trim().length > 0);

  async function submit() {
    if (!status) return;
    try {
      await mutation.mutateAsync({
        status,
        reason: needsReason ? reason.trim() : undefined,
      });
      toast.success(`Status updated to ${STATUS_LABELS[status]}`);
      onOpenChange(false);
      setStatus('');
      setReason('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to update status';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            Current status:{' '}
            <span className="font-medium">{STATUS_LABELS[currentStatus]}</span>
            {allowed.length === 0 &&
              ' — this lead is in a terminal state and cannot transition further.'}
          </DialogDescription>
        </DialogHeader>

        {allowed.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as LeadStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a status" />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsReason && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (required)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={
                    status === 'TENDER_LOST'
                      ? 'لماذا خسرنا المناقصة؟'
                      : 'لماذا تم رفض الفرصة؟'
                  }
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Updating…' : 'Update status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
