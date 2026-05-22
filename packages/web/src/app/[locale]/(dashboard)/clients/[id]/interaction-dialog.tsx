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
  type InteractionDirection,
  type InteractionType,
} from '@/lib/types/client';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

type InteractionVisibility = 'TEAM' | 'MANAGER_ONLY' | 'PRIVATE';

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
  const t = useTranslations('clients.interactionDialog');
  const interactionTypeLabel = useEnumLabel('interactionType');
  const directionLabel = useEnumLabel('interactionDirection');

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
      toast.error(t('subjectRequired'));
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
      toast.success(t('logged'));
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
          ?.response?.data?.message ?? t('logFailed');
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('type')}</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as InteractionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((tValue) => (
                  <SelectItem key={tValue} value={tValue}>
                    {interactionTypeLabel(tValue)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('direction')}</Label>
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
                    {directionLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('visibility')}</Label>
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
                    {t(`visibility${v}` as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="subject">{t('subject')}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="summary">{t('summary')}</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">{t('duration')}</Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">{t('location')}</Label>
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outcome">{t('outcome')}</Label>
            <Input
              id="outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nextAction">{t('nextAction')}</Label>
            <Input
              id="nextAction"
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
