'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
  STAGE_LABELS,
  type PipelineEntry,
  type PipelineStage,
} from '@/lib/types/pipeline';

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

// BPD-aligned VisitType labels (Arabic)
const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  CLIENT_OFFICE: 'زيارة مكتب العميل',
  SITE: 'زيارة الموقع',
  ABAK_OFFICE: 'العميل في مكتبنا',
  VIRTUAL: 'اجتماع افتراضي',
  EVENT: 'فعالية / معرض',
};

const SENTIMENT_LABELS: Record<ClientSentiment, string> = {
  VERY_INTERESTED: 'مهتم جداً',
  INTERESTED: 'مهتم',
  NEUTRAL: 'محايد',
  HESITANT: 'متردد',
  NOT_INTERESTED: 'غير مهتم',
};

// BPD M3-008: READY_FOR_RFQ qualification checklist (5 criteria)
const RFQ_CHECKLIST = [
  'تم تأكيد جدية العميل واهتمامه بالمضي قدماً',
  'نوع الخدمة أو المشروع محدد بوضوح',
  'الموقع أو المنطقة تم تحديده',
  'تم التواصل مع صاحب القرار',
  'الوثائق المطلوبة متاحة أو تم التعهد بها رسمياً',
];

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
  const createVisitMutation = useCreateVisit();
  const [nextStage, setNextStage] =
    useState<PipelineStage>('FIRST_CONTACT_MADE');
  const [reason, setReason] = useState('');
  const [postponedUntil, setPostponedUntil] = useState('');

  // READY_FOR_RFQ checklist dialog state
  const [rfqCheckOpen, setRfqCheckOpen] = useState(false);
  const [rfqEntry, setRfqEntry] = useState<PipelineEntry | null>(null);
  const [rfqChecked, setRfqChecked] = useState<boolean[]>(
    new Array(RFQ_CHECKLIST.length).fill(false),
  );

  // Visit dialog state
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
      // Show qualification checklist before actually setting the stage
      setRfqEntry(activeEntry);
      setRfqChecked(new Array(RFQ_CHECKLIST.length).fill(false));
      setRfqCheckOpen(true);
    }
    setNextStage(value);
  }

  async function submitMove() {
    if (!activeEntry) return;

    // If user selected READY_FOR_RFQ but checklist not confirmed, show it
    if (nextStage === 'READY_FOR_RFQ') {
      const allChecked = rfqChecked.every(Boolean);
      if (!allChecked) {
        setRfqEntry(activeEntry);
        setRfqChecked(new Array(RFQ_CHECKLIST.length).fill(false));
        setRfqCheckOpen(true);
        return;
      }
    }

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

  async function confirmRfqChecklist() {
    if (!rfqEntry) return;
    try {
      await moveMutation.mutateAsync({
        id: rfqEntry.id,
        stage: 'READY_FOR_RFQ',
      });
      toast.success(`Moved to ${STAGE_LABELS['READY_FOR_RFQ']}`);
      setRfqCheckOpen(false);
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

  async function submitVisit() {
    if (!visitPurpose.trim()) {
      toast.error('Purpose is required');
      return;
    }
    if (!visitScheduledAt) {
      toast.error('Scheduled date/time is required');
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
      toast.success('تم تسجيل الزيارة');
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
          ?.response?.data?.message ?? 'Failed to log visit';
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
            onClick={() => setVisitOpen(true)}
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            تسجيل زيارة
          </Button>
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

      {/* Move Stage Dialog */}
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

      {/* READY_FOR_RFQ Qualification Checklist Dialog */}
      <Dialog
        open={rfqCheckOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRfqCheckOpen(false);
            // Reset stage selection if user cancels
            if (activeEntry) {
              setNextStage(activeEntry.stage);
            }
          }
        }}
      >
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأهيل الفرصة لطلب عرض السعر</DialogTitle>
            <DialogDescription>
              يجب تأكيد جميع المعايير الخمسة للمضي قدماً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {RFQ_CHECKLIST.map((criterion, index) => (
              <div key={index} className="flex items-start gap-3">
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
                  {criterion}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={confirmRfqChecklist}
              disabled={!rfqChecked.every(Boolean) || moveMutation.isPending}
            >
              {moveMutation.isPending ? 'جاري النقل…' : 'تأكيد'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRfqCheckOpen(false);
                if (activeEntry) setNextStage(activeEntry.stage);
              }}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Visit Dialog */}
      <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل زيارة ميدانية</DialogTitle>
            <DialogDescription>
              سجّل تفاصيل الزيارة وسيتم إنشاء تفاعل تلقائي في CRM
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Visit Type */}
            <div className="space-y-2">
              <Label htmlFor="visitType">نوع الزيارة</Label>
              <Select
                value={visitType}
                onValueChange={(value) => setVisitType(value as VisitType)}
              >
                <SelectTrigger id="visitType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VISIT_TYPE_LABELS) as VisitType[]).map((vt) => (
                    <SelectItem key={vt} value={vt}>
                      {VISIT_TYPE_LABELS[vt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purpose / Discussion Summary */}
            <div className="space-y-2">
              <Label htmlFor="visitPurpose">ملخص النقاش</Label>
              <Textarea
                id="visitPurpose"
                value={visitPurpose}
                onChange={(e) => setVisitPurpose(e.target.value)}
                placeholder="موضوع الزيارة ومحاور النقاش الرئيسية"
                rows={3}
              />
            </div>

            {/* Scheduled At */}
            <div className="space-y-2">
              <Label htmlFor="visitScheduledAt">تاريخ ووقت الزيارة</Label>
              <Input
                id="visitScheduledAt"
                type="datetime-local"
                value={visitScheduledAt}
                onChange={(e) => setVisitScheduledAt(e.target.value)}
              />
            </div>

            {/* Key Outcomes */}
            <div className="space-y-2">
              <Label htmlFor="visitKeyOutcomes">النتائج الرئيسية</Label>
              <Textarea
                id="visitKeyOutcomes"
                value={visitKeyOutcomes}
                onChange={(e) => setVisitKeyOutcomes(e.target.value)}
                placeholder="النتائج والقرارات المتخذة"
                rows={2}
              />
            </div>

            {/* Client Sentiment */}
            <div className="space-y-2">
              <Label htmlFor="visitSentiment">مؤشر اهتمام العميل</Label>
              <Select
                value={visitSentiment}
                onValueChange={(value) =>
                  setVisitSentiment(value as ClientSentiment)
                }
              >
                <SelectTrigger id="visitSentiment">
                  <SelectValue placeholder="اختر مستوى الاهتمام" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SENTIMENT_LABELS) as ClientSentiment[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {SENTIMENT_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="visitNextAction">الخطوة التالية</Label>
              <Input
                id="visitNextAction"
                value={visitNextAction}
                onChange={(e) => setVisitNextAction(e.target.value)}
                placeholder="ما الإجراء المطلوب بعد هذه الزيارة؟"
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={submitVisit}
              disabled={createVisitMutation.isPending}
            >
              {createVisitMutation.isPending ? 'جاري الحفظ…' : 'حفظ الزيارة'}
            </Button>
            <Button variant="outline" onClick={() => setVisitOpen(false)}>
              إلغاء
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
