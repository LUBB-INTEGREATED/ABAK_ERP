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
import { useAssignLead, useUsers } from '@/lib/hooks/use-leads';

export function AssignDialog({
  open,
  onOpenChange,
  leadId,
  currentAssigneeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentAssigneeId: string | null;
}) {
  const users = useUsers();
  const [assignee, setAssignee] = useState<string>(currentAssigneeId ?? '');
  const mutation = useAssignLead(leadId);

  const activeUsers =
    users.data?.filter((user) => user.status === 'ACTIVE') ?? [];

  async function submit() {
    if (!assignee) return;
    try {
      await mutation.mutateAsync(assignee);
      toast.success('Lead reassigned');
      onOpenChange(false);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to assign';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign lead</DialogTitle>
          <DialogDescription>
            Pick an active teammate to own the follow-up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {activeUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {[user.firstName, user.lastName].filter(Boolean).join(' ') ||
                    user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!assignee || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
