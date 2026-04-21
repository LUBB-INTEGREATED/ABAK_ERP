'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRightLeft, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
} from '@/lib/hooks/use-pipeline';
import {
  CLOSED_STAGES,
  OPEN_STAGES,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type PipelineEntry,
  type PipelineStage,
} from '@/lib/types/pipeline';

const STAGE_ACCENT: Record<PipelineStage, string> = {
  NEW_LEAD: 'border-sky-200',
  INITIAL_CONTACT: 'border-sky-300',
  QUALIFICATION: 'border-indigo-300',
  RFQ_RECEIVED: 'border-abak-blue',
  QUOTE_SENT: 'border-abak-gold',
  NEGOTIATION: 'border-amber-400',
  WON: 'border-emerald-400',
  LOST: 'border-rose-400',
  POSTPONED: 'border-zinc-300',
};

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
  const [search, setSearch] = useState('');
  const filter = useMemo(
    () => ({ search: search.trim() || undefined }),
    [search],
  );
  const { data, isLoading, refetch, isFetching } = usePipeline(filter);
  const stats = usePipelineStats();
  const [activeEntry, setActiveEntry] = useState<PipelineEntry | null>(null);
  const moveMutation = useMoveStage();
  const [nextStage, setNextStage] = useState<PipelineStage>('INITIAL_CONTACT');
  const [reason, setReason] = useState('');
  const [postponedUntil, setPostponedUntil] = useState('');

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
    setNextStage(suggest ?? 'NEGOTIATION');
    setReason('');
    setPostponedUntil('');
  }

  async function submitMove() {
    if (!activeEntry) return;
    if (nextStage === 'LOST' && !reason.trim()) {
      toast.error('Reason is required for LOST');
      return;
    }
    if (nextStage === 'POSTPONED' && !postponedUntil) {
      toast.error('Postponed-until date is required');
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
      toast.success(`Moved to ${STAGE_LABELS[nextStage]}`);
      setActiveEntry(null);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to move';
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">Sales pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Every opportunity across all nine stages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCcw
              className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {kpi('Open opportunities', stats.data?.totals.openCount ?? '—')}
        {kpi('Open value', `${Math.round(openValue).toLocaleString()} SAR`)}
        {kpi('Won value', `${Math.round(wonValue).toLocaleString()} SAR`)}
        {kpi('Conversion', `${(conversion * 100).toFixed(1)}%`)}
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search lead / client number, name…"
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
            <DialogTitle>Move stage</DialogTitle>
            <DialogDescription>
              {activeEntry && (
                <>
                  Current: {STAGE_LABELS[activeEntry.stage]} ·{' '}
                  {(activeEntry.lead?.leadNumber ||
                    activeEntry.client?.clientNumber) ??
                    '—'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>New stage</Label>
              <Select
                value={nextStage}
                onValueChange={(value) => setNextStage(value as PipelineStage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.filter(
                    (s) => activeEntry && s !== activeEntry.stage,
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(nextStage === 'LOST' || nextStage === 'POSTPONED') && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            )}

            {nextStage === 'POSTPONED' && (
              <div className="space-y-2">
                <Label htmlFor="postponedUntil">Revisit on</Label>
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
              Cancel
            </Button>
            <Button onClick={submitMove} disabled={moveMutation.isPending}>
              {moveMutation.isPending ? 'Moving…' : 'Move'}
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
            {STAGE_LABELS[stage]}
          </div>
          <Badge variant="outline">{entries.length}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {Math.round(totalValue).toLocaleString()} SAR
        </div>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {isLoading && (
          <div className="text-xs text-muted-foreground">Loading…</div>
        )}
        {!isLoading && entries.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Empty
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
  const subject =
    entry.lead?.companyName ||
    entry.lead?.contactName ||
    entry.client?.companyName ||
    entry.client?.contactName ||
    'Unknown';
  const number =
    entry.lead?.leadNumber ||
    entry.client?.clientNumber ||
    entry.id.slice(0, 8);
  const owner = entry.owner
    ? [entry.owner.firstName, entry.owner.lastName].filter(Boolean).join(' ') ||
      entry.owner.email
    : 'Unassigned';

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
            className="-mr-2 h-7 px-2"
            onClick={onMove}
            aria-label="Move stage"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="text-sm font-medium">{subject}</div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{owner}</span>
          {entry.estimatedValue !== null && (
            <span>{entry.estimatedValue.toLocaleString()} SAR</span>
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
