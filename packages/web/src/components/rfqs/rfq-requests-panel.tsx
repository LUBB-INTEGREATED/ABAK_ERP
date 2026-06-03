'use client';

/**
 * Doc requests + Site-visit requests panel on an RFQ.
 *
 * Added 2026-05-21 per the process correction. Pricers (department engineers
 * working on a quote) use this to:
 *  - Ask the sales person for additional documents from the client.
 *  - Request a site visit before pricing complex/large projects.
 *
 * Norman notes:
 *  - Each request has a strong signifier of who owes a response (badge).
 *  - The "Raise request" sheet uses progressive disclosure — short title +
 *    optional preferred dates only appear for site visits.
 *  - Resolving / cancelling shows immediate visual feedback (status flips
 *    via optimistic mutation invalidation; row gets a faded tone).
 *  - Empty state explains the activity, not just "nothing here".
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §D/E.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarRange,
  CheckCircle2,
  FileQuestion,
  MapPinned,
  Plus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  type RfqDocRequest,
  type RfqRequestStatus,
  type RfqSiteVisitRequest,
  useCreateRfqDocRequest,
  useCreateRfqSiteVisitRequest,
  useRfqDocRequests,
  useRfqSiteVisitRequests,
  useUpdateRfqDocRequest,
  useUpdateRfqSiteVisitRequest,
} from '@/lib/hooks/use-rfq-assignments';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<
  RfqRequestStatus,
  { labelKey: string; className: string }
> = {
  PENDING: {
    labelKey: 'statusOpen',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  RESOLVED: {
    labelKey: 'statusResolved',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  CANCELLED: {
    labelKey: 'statusCancelled',
    className: 'border-muted bg-muted/40 text-muted-foreground',
  },
};

export function RfqRequestsPanel({ rfqId }: { rfqId: string }) {
  const t = useTranslations('rfqRequests');
  const { data: docs = [], isLoading: docsLoading } = useRfqDocRequests(rfqId);
  const { data: visits = [], isLoading: visitsLoading } =
    useRfqSiteVisitRequests(rfqId);

  const openDocCount = docs.filter((d) => d.status === 'PENDING').length;
  const openVisitCount = visits.filter((v) => v.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileQuestion className="h-4 w-4 text-abak-blue" />
              {t('docRequestsTitle')}
              {openDocCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-300 text-amber-700"
                >
                  {t('openCount', { count: openDocCount })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t('docRequestsDescription')}</CardDescription>
          </div>
          <NewDocRequestSheet rfqId={rfqId} />
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('loading')}
            </p>
          ) : docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('docRequestsEmpty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <DocRequestRow key={d.id} rfqId={rfqId} req={d} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPinned className="h-4 w-4 text-abak-blue" />
              {t('siteVisitsTitle')}
              {openVisitCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-300 text-amber-700"
                >
                  {t('openCount', { count: openVisitCount })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t('siteVisitsDescription')}</CardDescription>
          </div>
          <NewSiteVisitSheet rfqId={rfqId} />
        </CardHeader>
        <CardContent>
          {visitsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('loading')}
            </p>
          ) : visits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('siteVisitsEmpty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => (
                <SiteVisitRow key={v.id} rfqId={rfqId} req={v} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------
// Doc request — row + new sheet
// ------------------------------------------------------------------

function DocRequestRow({ rfqId, req }: { rfqId: string; req: RfqDocRequest }) {
  const t = useTranslations('rfqRequests');
  const td = useTranslations('detail');
  const update = useUpdateRfqDocRequest(rfqId);
  const tone = STATUS_TONE[req.status];
  const isOpen = req.status === 'PENDING';

  async function resolve() {
    try {
      await update.mutateAsync({ requestId: req.id, status: 'RESOLVED' });
      toast.success(t('toastMarkedResolved'));
    } catch {
      toast.error(t('toastFailedUpdate'));
    }
  }

  async function cancel() {
    try {
      await update.mutateAsync({ requestId: req.id, status: 'CANCELLED' });
      toast.success(t('toastCancelled'));
    } catch {
      toast.error(t('toastFailedUpdate'));
    }
  }

  return (
    <li
      className={cn(
        'rounded-md border p-3 transition-colors',
        isOpen ? 'bg-card' : 'bg-muted/30',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', tone.className)}>
              {t(tone.labelKey)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(req.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{req.description}</p>
          {req.response && (
            <p className="mt-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-900">
              <strong>{t('responseLabel')}</strong> {req.response}
            </p>
          )}
          {req.attachmentUrl && (
            <a
              href={req.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-abak-blue underline"
            >
              {t('viewAttachment')}
            </a>
          )}
        </div>
        {isOpen && (
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={resolve}
              disabled={update.isPending}
              title={t('markAsResolved')}
            >
              <CheckCircle2 className="me-1 h-3.5 w-3.5" />
              {t('resolve')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={update.isPending}
              className="text-muted-foreground"
              title={t('cancelThisRequest')}
            >
              <XCircle className="me-1 h-3.5 w-3.5" />
              {td('cancel')}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function NewDocRequestSheet({ rfqId }: { rfqId: string }) {
  const t = useTranslations('rfqRequests');
  const td = useTranslations('detail');
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const create = useCreateRfqDocRequest(rfqId);

  async function submit() {
    if (description.trim().length < 5) {
      toast.error(t('errorDescribeNeed'));
      return;
    }
    try {
      await create.mutateAsync({ description: description.trim() });
      toast.success(t('toastDocRequestRaised'));
      setDescription('');
      setOpen(false);
    } catch {
      toast.error(t('toastFailedRaise'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="me-1 h-4 w-4" />
          {t('raiseRequest')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('requestDocumentTitle')}</SheetTitle>
          <SheetDescription>{t('requestDocumentDescription')}</SheetDescription>
        </SheetHeader>
        <div className="my-6 space-y-3">
          <Label htmlFor="doc-desc">{t('whatDoYouNeed')}</Label>
          <Textarea
            id="doc-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('docDescPlaceholder')}
          />
        </div>
        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={create.isPending}
          >
            {td('cancel')}
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? t('raising') : t('raiseRequest')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ------------------------------------------------------------------
// Site visit — row + new sheet
// ------------------------------------------------------------------

function SiteVisitRow({
  rfqId,
  req,
}: {
  rfqId: string;
  req: RfqSiteVisitRequest;
}) {
  const t = useTranslations('rfqRequests');
  const update = useUpdateRfqSiteVisitRequest(rfqId);
  const tone = STATUS_TONE[req.status];
  const isOpen = req.status === 'PENDING';

  async function scheduleNow() {
    const when = window.prompt(t('schedulePrompt'), '');
    if (!when) return;
    try {
      await update.mutateAsync({
        requestId: req.id,
        scheduledAt: new Date(when).toISOString(),
      });
      toast.success(t('toastVisitScheduled'));
    } catch {
      toast.error(t('toastFailedSchedule'));
    }
  }

  async function complete() {
    try {
      await update.mutateAsync({
        requestId: req.id,
        status: 'RESOLVED',
        completedAt: new Date().toISOString(),
      });
      toast.success(t('toastVisitCompleted'));
    } catch {
      toast.error(t('toastFailedUpdate'));
    }
  }

  async function cancel() {
    try {
      await update.mutateAsync({ requestId: req.id, status: 'CANCELLED' });
      toast.success(t('toastCancelled'));
    } catch {
      toast.error(t('toastFailedCancel'));
    }
  }

  return (
    <li
      className={cn(
        'rounded-md border p-3 transition-colors',
        isOpen ? 'bg-card' : 'bg-muted/30',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', tone.className)}>
              {t(tone.labelKey)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(req.createdAt).toLocaleDateString()}
            </span>
            {req.scheduledAt && (
              <Badge variant="outline" className="text-xs">
                <CalendarRange className="me-1 h-3 w-3" />
                {new Date(req.scheduledAt).toLocaleString()}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{req.purpose}</p>
          {(req.preferredDateFrom || req.preferredDateTo) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('preferredWindow')}{' '}
              {req.preferredDateFrom
                ? new Date(req.preferredDateFrom).toLocaleDateString()
                : '—'}
              {' → '}
              {req.preferredDateTo
                ? new Date(req.preferredDateTo).toLocaleDateString()
                : '—'}
            </p>
          )}
          {req.notes && (
            <p className="mt-2 rounded-md bg-muted p-2 text-xs">{req.notes}</p>
          )}
        </div>
        {isOpen && (
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={scheduleNow}
              disabled={update.isPending}
            >
              <CalendarRange className="me-1 h-3.5 w-3.5" />
              {t('schedule')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={complete}
              disabled={update.isPending}
            >
              <CheckCircle2 className="me-1 h-3.5 w-3.5" />
              {t('complete')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={update.isPending}
              className="text-muted-foreground"
            >
              <XCircle className="me-1 h-3.5 w-3.5" />
              {t('cancel')}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function NewSiteVisitSheet({ rfqId }: { rfqId: string }) {
  const t = useTranslations('rfqRequests');
  const td = useTranslations('detail');
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const create = useCreateRfqSiteVisitRequest(rfqId);

  async function submit() {
    if (purpose.trim().length < 5) {
      toast.error(t('errorExplainPurpose'));
      return;
    }
    try {
      await create.mutateAsync({
        purpose: purpose.trim(),
        preferredDateFrom: from ? new Date(from).toISOString() : undefined,
        preferredDateTo: to ? new Date(to).toISOString() : undefined,
      });
      toast.success(t('toastSiteVisitRaised'));
      setPurpose('');
      setFrom('');
      setTo('');
      setOpen(false);
    } catch {
      toast.error(t('toastFailedRaise'));
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="me-1 h-4 w-4" />
          {t('requestVisit')}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('requestSiteVisitTitle')}</SheetTitle>
          <SheetDescription>
            {t('requestSiteVisitDescription')}
          </SheetDescription>
        </SheetHeader>
        <div className="my-6 space-y-4">
          <div>
            <Label htmlFor="visit-purpose">{t('purpose')}</Label>
            <Textarea
              id="visit-purpose"
              rows={4}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={t('purposePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="visit-from">{t('preferredFrom')}</Label>
              <Input
                id="visit-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="visit-to">{t('preferredTo')}</Label>
              <Input
                id="visit-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={create.isPending}
          >
            {td('cancel')}
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? t('requesting') : t('requestVisit')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
