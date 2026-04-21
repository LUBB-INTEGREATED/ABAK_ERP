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
import { useAddFollowUp } from '@/lib/hooks/use-clients';
import { useUsers } from '@/lib/hooks/use-leads';
import {
  FOLLOW_UP_TYPES,
  FOLLOW_UP_TYPE_LABELS,
  type FollowUpType,
} from '@/lib/types/client';

export function FollowUpDialog({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<FollowUpType>('GENERAL');
  const [dueAt, setDueAt] = useState('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const users = useUsers();
  const mutation = useAddFollowUp(clientId);
  const activeUsers =
    users.data?.filter((user) => user.status === 'ACTIVE') ?? [];

  async function submit() {
    if (title.trim().length < 2 || !dueAt) {
      toast.error('Title and due date are required');
      return;
    }
    try {
      await mutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        dueAt: new Date(dueAt).toISOString(),
        assignedToId: assignedToId || undefined,
      });
      toast.success('Follow-up scheduled');
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setDueAt('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to save';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>
            Pick a date and (optionally) the teammate who owns the action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueAt">Due date</Label>
            <Input
              id="dueAt"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as FollowUpType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FOLLOW_UP_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assignee (optional)</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {[user.firstName, user.lastName]
                      .filter(Boolean)
                      .join(' ') || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
