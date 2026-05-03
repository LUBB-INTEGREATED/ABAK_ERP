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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddInteraction } from '@/lib/hooks/use-clients';
import {
  INTERACTION_DIRECTIONS,
  INTERACTION_TYPES,
  INTERACTION_TYPE_LABELS,
  type InteractionDirection,
  type InteractionType,
} from '@/lib/types/client';

type InteractionVisibility = 'TEAM' | 'MANAGER_ONLY' | 'PRIVATE';

const VISIBILITY_LABELS: Record<InteractionVisibility, string> = {
  TEAM: 'الفريق',
  MANAGER_ONLY: 'المدير فقط',
  PRIVATE: 'خاص',
};

const VISIBILITY_OPTIONS: InteractionVisibility[] = [
  'TEAM',
  'MANAGER_ONLY',
  'PRIVATE',
];

export function InteractionDialog({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}) {
  const [type, setType] = useState<InteractionType>('CALL');
  const [direction, setDirection] = useState<InteractionDirection | undefined>(
    'OUTBOUND',
  );
  const [visibility, setVisibility] = useState<InteractionVisibility>('TEAM');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');
  const mutation = useAddInteraction(clientId);

  async function submit() {
    if (subject.trim().length < 2) {
      toast.error('Subject is required');
      return;
    }
    try {
      await mutation.mutateAsync({
        type,
        direction,
        visibility,
        subject: subject.trim(),
        summary: summary.trim() || undefined,
        durationMinutes: duration ? Number(duration) : undefined,
        location: location.trim() || undefined,
        outcome: outcome.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
      });
      toast.success('Interaction logged');
      onOpenChange(false);
      setSubject('');
      setSummary('');
      setDuration('');
      setLocation('');
      setOutcome('');
      setNextAction('');
      setVisibility('TEAM');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to log';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Log an interaction</DialogTitle>
          <DialogDescription>
            Every call, meeting, and message lands on the 360° timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as InteractionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {INTERACTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select
              value={direction ?? 'OUTBOUND'}
              onValueChange={(value) =>
                setDirection(value as InteractionDirection)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d === 'INBOUND' ? 'Inbound' : 'Outbound'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الظهور</Label>
            <Select
              value={visibility}
              onValueChange={(value) =>
                setVisibility(value as InteractionVisibility)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome</Label>
            <Input
              id="outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextAction">Next action</Label>
            <Input
              id="nextAction"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Log'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
