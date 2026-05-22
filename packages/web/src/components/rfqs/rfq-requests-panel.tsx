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
  { label: string; className: string }
> = {
  OPEN: {
    label: 'Open',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  RESOLVED: {
    label: 'Resolved',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'border-muted bg-muted/40 text-muted-foreground',
  },
};

export function RfqRequestsPanel({ rfqId }: { rfqId: string }) {
  const { data: docs = [], isLoading: docsLoading } = useRfqDocRequests(rfqId);
  const { data: visits = [], isLoading: visitsLoading } =
    useRfqSiteVisitRequests(rfqId);

  const openDocCount = docs.filter((d) => d.status === 'OPEN').length;
  const openVisitCount = visits.filter((v) => v.status === 'OPEN').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileQuestion className="h-4 w-4 text-abak-blue" />
              Document requests
              {openDocCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-300 text-amber-700"
                >
                  {openDocCount} open
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Ask the sales person for additional documents from the client
              (CAD, soil report, site photos, contract clarifications…).
            </CardDescription>
          </div>
          <NewDocRequestSheet rfqId={rfqId} />
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No document requests yet. Raise one above if anything is missing.
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
              Site-visit requests
              {openVisitCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-300 text-amber-700"
                >
                  {openVisitCount} open
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Need to walk the site before pricing? The sales person makes the
              first contact; after that you can coordinate logistics with the
              client directly (CC sales for the record).
            </CardDescription>
          </div>
          <NewSiteVisitSheet rfqId={rfqId} />
        </CardHeader>
        <CardContent>
          {visitsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : visits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No site visits requested yet.
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
  const update = useUpdateRfqDocRequest(rfqId);
  const tone = STATUS_TONE[req.status];
  const isOpen = req.status === 'OPEN';

  async function resolve() {
    try {
      await update.mutateAsync({ requestId: req.id, status: 'RESOLVED' });
      toast.success('Marked resolved.');
    } catch {
      toast.error('Failed to update.');
    }
  }

  async function cancel() {
    try {
      await update.mutateAsync({ requestId: req.id, status: 'CANCELLED' });
      toast.success('Cancelled.');
    } catch {
      toast.error('Failed to update.');
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
              {tone.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(req.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap">{req.description}</p>
          {req.response && (
            <p className="mt-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-900">
              <strong>Response:</strong> {req.response}
            </p>
          )}
          {req.attachmentUrl && (
            <a
              href={req.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-abak-blue underline"
            >
              View attachment
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
              title="Mark as resolved"
            >
              <CheckCircle2 className="me-1 h-3.5 w-3.5" />
              Resolve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={update.isPending}
              className="text-muted-foreground"
              title="Cancel this request"
            >
              <XCircle className="me-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function NewDocRequestSheet({ rfqId }: { rfqId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const create = useCreateRfqDocRequest(rfqId);

  async function submit() {
    if (description.trim().length < 5) {
      toast.error('Describe what you need (5+ characters).');
      return;
    }
    try {
      await create.mutateAsync({ description: description.trim() });
      toast.success('Request raised. Sales person will be notified.');
      setDescription('');
      setOpen(false);
    } catch {
      toast.error('Failed to raise request.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="me-1 h-4 w-4" />
          Raise request
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Request a document</SheetTitle>
          <SheetDescription>
            Be specific — the sales person will forward this verbatim to the
            client.
          </SheetDescription>
        </SheetHeader>
        <div className="my-6 space-y-3">
          <Label htmlFor="doc-desc">What do you need?</Label>
          <Textarea
            id="doc-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`e.g. "Updated CAD plan with the new mezzanine, soil-test report from the geotechnical survey."`}
          />
        </div>
        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Raising…' : 'Raise request'}
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
  const update = useUpdateRfqSiteVisitRequest(rfqId);
  const tone = STATUS_TONE[req.status];
  const isOpen = req.status === 'OPEN';

  async function scheduleNow() {
    const when = window.prompt(
      'Scheduled at (YYYY-MM-DD HH:mm). Leave empty to skip.',
      '',
    );
    if (!when) return;
    try {
      await update.mutateAsync({
        requestId: req.id,
        scheduledAt: new Date(when).toISOString(),
      });
      toast.success('Visit scheduled.');
    } catch {
      toast.error('Failed to schedule.');
    }
  }

  async function complete() {
    try {
      await update.mutateAsync({
        requestId: req.id,
        status: 'RESOLVED',
        completedAt: new Date().toISOString(),
      });
      toast.success('Visit marked complete.');
    } catch {
      toast.error('Failed to update.');
    }
  }

  async function cancel() {
    try {
      await update.mutateAsync({ requestId: req.id, status: 'CANCELLED' });
      toast.success('Cancelled.');
    } catch {
      toast.error('Failed to cancel.');
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
              {tone.label}
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
              Preferred window:{' '}
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
              Schedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={complete}
              disabled={update.isPending}
            >
              <CheckCircle2 className="me-1 h-3.5 w-3.5" />
              Complete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={update.isPending}
              className="text-muted-foreground"
            >
              <XCircle className="me-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function NewSiteVisitSheet({ rfqId }: { rfqId: string }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const create = useCreateRfqSiteVisitRequest(rfqId);

  async function submit() {
    if (purpose.trim().length < 5) {
      toast.error('Explain the purpose (5+ characters).');
      return;
    }
    try {
      await create.mutateAsync({
        purpose: purpose.trim(),
        preferredDateFrom: from ? new Date(from).toISOString() : undefined,
        preferredDateTo: to ? new Date(to).toISOString() : undefined,
      });
      toast.success('Site-visit request raised. Sales person will reach out.');
      setPurpose('');
      setFrom('');
      setTo('');
      setOpen(false);
    } catch {
      toast.error('Failed to raise request.');
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="me-1 h-4 w-4" />
          Request visit
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Request a site visit</SheetTitle>
          <SheetDescription>
            Explain why a visit is needed and an optional date window. The sales
            person makes the first call; logistics with the client can then go
            direct.
          </SheetDescription>
        </SheetHeader>
        <div className="my-6 space-y-4">
          <div>
            <Label htmlFor="visit-purpose">Purpose</Label>
            <Textarea
              id="visit-purpose"
              rows={4}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={`e.g. "Need to verify column spacing & assess existing MEP risers before pricing structural retrofit."`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="visit-from">Preferred from</Label>
              <Input
                id="visit-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="visit-to">Preferred to</Label>
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
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Requesting…' : 'Request visit'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
