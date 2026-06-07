'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import { ArrowRightLeft, CalendarPlus, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import {
  useMoveStage,
  usePipeline,
  usePipelineStats,
  useCreateVisit,
  type ClientSentiment,
  type VisitType,
} from '@/lib/hooks/use-pipeline';
import {
  CLOSED_STAGES,
  OPEN_STAGES,
  PIPELINE_STAGES,
  type PipelineEntry,
  type PipelineStage,
} from '@/lib/types/pipeline';
import { useEnumLabel } from '@/lib/i18n/enum-labels';

const STAGE_ACCENT: Record<PipelineStage, string> = {
  NEW_LEAD: 'border-sky-200',
  FIRST_CONTACT_MADE: 'border-sky-300',
  MEETING_SCHEDULED: 'border-indigo-200',
  MEETING_DONE: 'border-indigo-300',
  READY_FOR_RFQ: 'border-violet-300',
  RFQ_SUBMITTED: 'border-abak-blue',
  QUOTE_IN_PREPARATION: 'border-blue-400',
  QUOTE_SENT_TO_CLIENT: 'border-abak-gold',
  NEGOTIATION_REVISION: 'border-amber-400',
  WON: 'border-emerald-400',
  LOST: 'border-rose-400',
  POSTPONED: 'border-zinc-300',
};

const RFQ_KEYS = [
  'rfqCriterion1',
  'rfqCriterion2',
  'rfqCriterion3',
  'rfqCriterion4',
  'rfqCriterion5',
] as const;

function kpi(label: string, value: string | number) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold text-abak-blue">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PipelinePage() {
  const t = useTranslations('pipelineUi');
  const locale = useLocale();
  const stageLabel = useEnumLabel('pipelineStage');
  const visitTypeLabel = useEnumLabel('visitType');
  const sentimentLabel = useEnumLabel('interestLevel');

  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';

  const [search, setSearch] = useState('');
  const filter = useMemo(
    () => ({ search: search.trim() || undefined }),
    [search],
  );
  const { data, isLoading, refetch, isFetching } = usePipeline(filter);
  const stats = usePipelineStats();
  const [activeEntry, setActiveEntry] = useState<PipelineEntry | null>(null);
  const moveMutation = useMoveStage();
  const createVisitMutation = useCreateVisit();
  const [nextStage, setNextStage] =
    useState<PipelineStage>('FIRST_CONTACT_MADE');
  const [reason, setReason] = useState('');
  const [postponedUntil, setPostponedUntil] = useState('');

  const [rfqCheckOpen, setRfqCheckOpen] = useState(false);
  const [rfqEntry, setRfqEntry] = useState<PipelineEntry | null>(null);
  const [rfqChecked, setRfqChecked] = useState<boolean[]>(
    new Array(RFQ_KEYS.length).fill(false),
  );

  const [visitOpen, setVisitOpen] = useState(false);
  const [visitType, setVisitType] = useState<VisitType>('CLIENT_OFFICE');
  const [visitPurpose, setVisitPurpose] = useState('');
  const [visitScheduledAt, setVisitScheduledAt] = useState('');
  const [visitKeyOutcomes, setVisitKeyOutcomes] = useState('');
  const [visitSentiment, setVisitSentiment] = useState<ClientSentiment | ''>(
    '',
  );
  const [visitNextAction, setVisitNextAction] = useState('');

  const entriesByStage = new Map<PipelineStage, PipelineEntry[]>();
  for (const stage of PIPELINE_STAGES) entriesByStage.set(stage, []);
  for (const entry of data?.data ?? []) {
    entriesByStage.get(entry.stage)?.push(entry);
  }

  const openValue = stats.data?.totals.openEstimatedValue ?? 0;
  const wonValue = stats.data?.totals.wonValue ?? 0;
  const conversion = stats.data?.totals.conversionRate ?? 0;

  function openMoveDialog(entry: PipelineEntry) {
    setActiveEntry(entry);
    const currentIndex = PIPELINE_STAGES.indexOf(entry.stage);
    const suggest =
      OPEN_STAGES[Math.min(currentIndex + 1, OPEN_STAGES.length - 1)];
    setNextStage(suggest ?? 'NEGOTIATION_REVISION');
    setReason('');
    setPostponedUntil('');
  }

  function handleStageSelectChange(value: PipelineStage) {
    if (value === 'READY_FOR_RFQ' && activeEntry) {
      setRfqEntry(activeEntry);
      setRfqChecked(new Array(RFQ_KEYS.length).fill(false));
      setRfqCheckOpen(true);
    }
    setNextStage(value);
  }

  async function submitMove() {
    if (!activeEntry) return;

    if (nextStage === 'READY_FOR_RFQ') {
      const allChecked = rfqChecked.every(Boolean);
      if (!allChecked) {
        setRfqEntry(activeEntry);
        setRfqChecked(new Array(RFQ_KEYS.length).fill(false));
        setRfqCheckOpen(true);
        return;
      }
    }

    if (nextStage === 'LOST' && !reason.trim()) {
      toast.error(t('reasonRequiredLost'));
      return;
    }
    if (nextStage === 'POSTPONED' && !postponedUntil) {
      toast.error(t('postponedDateRequired'));
      return;
    }
    try {
      await moveMutation.mutateAsync({
        id: activeEntry.id,
        stage: nextStage,
        reason: reason.trim() || undefined,
        postponedUntil: postponedUntil
          ? new Date(postponedUntil).toISOString()
          : undefined,
      });
      toast.success(t('movedTo', { stage: stageLabel(nextStage) }));
      setActiveEntry(null);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('moveFailed');
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  async function confirmRfqChecklist() {
    if (!rfqEntry) return;
    try {
      await moveMutation.mutateAsync({
        id: rfqEntry.id,
        stage: 'READY_FOR_RFQ',
      });
      toast.success(t('movedTo', { stage: stageLabel('READY_FOR_RFQ') }));
      setRfqCheckOpen(false);
      setActiveEntry(null);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('moveFailed');
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  async function submitVisit() {
    if (!visitPurpose.trim()) {
      toast.error(t('purposeRequired'));
      return;
    }
    if (!visitScheduledAt) {
      toast.error(t('scheduledDateRequired'));
      return;
    }
    try {
      await createVisitMutation.mutateAsync({
        visitType,
        purpose: visitPurpose.trim(),
        scheduledAt: new Date(visitScheduledAt).toISOString(),
        keyOutcomes: visitKeyOutcomes.trim() || undefined,
        clientSentiment: visitSentiment || undefined,
        attachmentUrls: [],
      });
      toast.success(t('visitLogged'));
      setVisitOpen(false);
      setVisitType('CLIENT_OFFICE');
      setVisitPurpose('');
      setVisitScheduledAt('');
      setVisitKeyOutcomes('');
      setVisitSentiment('');
      setVisitNextAction('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('logVisitFailed');
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisitOpen(true)}
          >
            <CalendarPlus className="me-2 h-4 w-4" />
            {t('logVisit')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label={t('refresh')}
            title={t('refresh')}
          >
            <RefreshCcw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {kpi(t('kpiOpenOpportunities'), stats.data?.totals.openCount ?? '—')}
        {kpi(
          t('kpiOpenValue'),
          `${Math.round(openValue).toLocaleString(numLocale)} SAR`,
        )}
        {kpi(
          t('kpiWonValue'),
          `${Math.round(wonValue).toLocaleString(numLocale)} SAR`,
        )}
        {kpi(t('kpiConversion'), `${(conversion * 100).toFixed(1)}%`)}
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {OPEN_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            entries={entriesByStage.get(stage) ?? []}
            isLoading={isLoading}
            onMove={openMoveDialog}
          />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {CLOSED_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            entries={entriesByStage.get(stage) ?? []}
            isLoading={isLoading}
            compact
            onMove={openMoveDialog}
          />
        ))}
      </div>

      <Dialog
        open={Boolean(activeEntry)}
        onOpenChange={(open) => !open && setActiveEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('moveStage')}</DialogTitle>
            <DialogDescription>
              {activeEntry &&
                t('moveCurrent', {
                  stage: stageLabel(activeEntry.stage),
                  number:
                    (activeEntry.lead?.leadNumber ||
                      activeEntry.client?.clientNumber) ??
                    '—',
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t('newStageLabel')}</Label>
              <Select
                value={nextStage}
                onValueChange={(value) =>
                  handleStageSelectChange(value as PipelineStage)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.filter(
                    (s) => activeEntry && s !== activeEntry.stage,
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {stageLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(nextStage === 'LOST' || nextStage === 'POSTPONED') && (
              <div className="space-y-2">
                <Label htmlFor="reason">{t('reasonLabel')}</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            )}

            {nextStage === 'POSTPONED' && (
              <div className="space-y-2">
                <Label htmlFor="postponedUntil">{t('revisitOn')}</Label>
                <Input
                  id="postponedUntil"
                  type="date"
                  value={postponedUntil}
                  onChange={(event) => setPostponedUntil(event.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveEntry(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitMove} disabled={moveMutation.isPending}>
              {moveMutation.isPending ? t('movingTo') : t('moveButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rfqCheckOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRfqCheckOpen(false);
            if (activeEntry) {
              setNextStage(activeEntry.stage);
            }
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('rfqTitle')}</DialogTitle>
            <DialogDescription>{t('rfqDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {RFQ_KEYS.map((key, index) => (
              <div key={key} className="flex items-start gap-3">
                <Checkbox
                  id={`rfq-check-${index}`}
                  checked={rfqChecked[index]}
                  onCheckedChange={(checked) => {
                    const updated = [...rfqChecked];
                    updated[index] = Boolean(checked);
                    setRfqChecked(updated);
                  }}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`rfq-check-${index}`}
                  className="cursor-pointer text-sm leading-snug"
                >
                  {t(key)}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRfqCheckOpen(false);
                if (activeEntry) setNextStage(activeEntry.stage);
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={confirmRfqChecklist}
              disabled={!rfqChecked.every(Boolean) || moveMutation.isPending}
            >
              {moveMutation.isPending ? t('movingTo') : t('rfqConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('logVisitTitle')}</DialogTitle>
            <DialogDescription>{t('logVisitDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="visitType">{t('visitType')}</Label>
              <Select
                value={visitType}
                onValueChange={(value) => setVisitType(value as VisitType)}
              >
                <SelectTrigger id="visitType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      'CLIENT_OFFICE',
                      'SITE',
                      'ABAK_OFFICE',
                      'VIRTUAL',
                      'EVENT',
                    ] as VisitType[]
                  ).map((vt) => (
                    <SelectItem key={vt} value={vt}>
                      {visitTypeLabel(vt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitPurpose">{t('discussionSummary')}</Label>
              <Textarea
                id="visitPurpose"
                value={visitPurpose}
                onChange={(e) => setVisitPurpose(e.target.value)}
                placeholder={t('discussionPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitScheduledAt">{t('scheduledAt')}</Label>
              <Input
                id="visitScheduledAt"
                type="datetime-local"
                value={visitScheduledAt}
                onChange={(e) => setVisitScheduledAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitKeyOutcomes">{t('keyOutcomes')}</Label>
              <Textarea
                id="visitKeyOutcomes"
                value={visitKeyOutcomes}
                onChange={(e) => setVisitKeyOutcomes(e.target.value)}
                placeholder={t('keyOutcomesPlaceholder')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitSentiment">{t('clientSentiment')}</Label>
              <Select
                value={visitSentiment}
                onValueChange={(value) =>
                  setVisitSentiment(value as ClientSentiment)
                }
              >
                <SelectTrigger id="visitSentiment">
                  <SelectValue placeholder={t('selectSentiment')} />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      'VERY_INTERESTED',
                      'INTERESTED',
                      'NEUTRAL',
                      'HESITANT',
                      'NOT_INTERESTED',
                    ] as ClientSentiment[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {sentimentLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitNextAction">{t('nextActionLabel')}</Label>
              <Input
                id="visitNextAction"
                value={visitNextAction}
                onChange={(e) => setVisitNextAction(e.target.value)}
                placeholder={t('nextActionPlaceholder')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVisitOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={submitVisit}
              disabled={createVisitMutation.isPending}
            >
              {createVisitMutation.isPending
                ? t('savingVisit')
                : t('saveVisit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageColumn({
  stage,
  entries,
  isLoading,
  compact,
  onMove,
}: {
  stage: PipelineStage;
  entries: PipelineEntry[];
  isLoading: boolean;
  compact?: boolean;
  onMove: (entry: PipelineEntry) => void;
}) {
  const t = useTranslations('pipelineUi');
  const stageLabel = useEnumLabel('pipelineStage');
  const locale = useLocale();
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';

  const totalValue = entries.reduce(
    (sum, entry) => sum + (entry.estimatedValue ?? 0),
    0,
  );
  return (
    <div
      className={cn(
        'flex w-[300px] flex-shrink-0 flex-col rounded-lg border-t-4 bg-white shadow-sm',
        STAGE_ACCENT[stage],
        compact && 'w-full',
      )}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-abak-blue">
            {stageLabel(stage)}
          </div>
          <Badge variant="outline">{entries.length}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {Math.round(totalValue).toLocaleString(numLocale)} SAR
        </div>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {isLoading && (
          <div className="text-xs text-muted-foreground">{t('loading')}</div>
        )}
        {!isLoading && entries.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {t('empty')}
          </div>
        )}
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onMove={() => onMove(entry)}
          />
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  onMove,
}: {
  entry: PipelineEntry;
  onMove: () => void;
}) {
  const t = useTranslations('pipelineUi');
  const locale = useLocale();
  const numLocale = locale === 'ar' ? 'ar-SA' : 'en-US';

  const subject =
    entry.lead?.companyName ||
    entry.lead?.contactName ||
    entry.client?.companyName ||
    entry.client?.contactName ||
    t('unknown');
  const number =
    entry.lead?.leadNumber ||
    entry.client?.clientNumber ||
    entry.id.slice(0, 8);
  const owner = entry.owner
    ? [entry.owner.firstName, entry.owner.lastName].filter(Boolean).join(' ') ||
      entry.owner.email
    : t('unassigned');

  const href = entry.lead
    ? `/leads/${entry.lead.id}`
    : entry.client
      ? `/clients/${entry.client.id}`
      : '#';

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={href}
            className="font-mono text-xs text-abak-blue hover:underline"
          >
            {number}
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="-me-2 h-7 px-2"
            onClick={onMove}
            aria-label={t('moveStage')}
          >
            <ArrowRightLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </Button>
        </div>
        <div className="text-sm font-medium">{subject}</div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{owner}</span>
          {entry.estimatedValue !== null && (
            <span>{entry.estimatedValue.toLocaleString(numLocale)} SAR</span>
          )}
        </div>
        {entry.probability !== null && (
          <div className="h-1 rounded bg-muted">
            <div
              className="h-full rounded bg-abak-blue"
              style={{ width: `${entry.probability}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
