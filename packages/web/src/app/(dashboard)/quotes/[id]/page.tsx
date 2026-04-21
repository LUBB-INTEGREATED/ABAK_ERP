'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BadgeCheck,
  BadgeDollarSign,
  FileText,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useAcceptQuote,
  useDecideApproval,
  useQuote,
  useRejectQuote,
  useSendQuote,
  useSubmitQuote,
} from '@/lib/hooks/use-quotes';
import { useAuthStore } from '@/lib/auth';
import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/types/quote';

const STATUS_BADGE: Record<QuoteStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  PENDING_REVIEW: 'bg-sky-100 text-sky-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-abak-blue/10 text-abak-blue',
  SENT: 'bg-indigo-100 text-indigo-700',
  VIEWED: 'bg-indigo-200 text-indigo-700',
  UNDER_NEGOTIATION: 'bg-abak-gold/20 text-abak-gold',
  REVISED: 'bg-sky-200 text-sky-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-zinc-200 text-zinc-700',
};

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: quote, isLoading, isError, error } = useQuote(id);
  const user = useAuthStore((state) => state.user);
  const submitMutation = useSubmitQuote(id);
  const sendMutation = useSendQuote(id);
  const acceptMutation = useAcceptQuote(id);
  const rejectMutation = useRejectQuote(id);
  const decideMutation = useDecideApproval(id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  if (isError || !quote) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {error instanceof Error ? error.message : 'Quote not found'}
          </CardContent>
        </Card>
      </div>
    );
  }

  async function callMutation<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    try {
      const result = await fn();
      toast.success(label);
      return result;
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? `Failed to ${label.toLowerCase()}`;
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
      return null;
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-mono text-sm text-muted-foreground">
              {quote.quoteNumber}
              {quote.version > 1 && ` (v${quote.version})`}
            </div>
            <h1 className="text-2xl font-bold text-abak-blue">{quote.title}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              <Link
                href={`/clients/${quote.client.id}`}
                className="text-abak-blue hover:underline"
              >
                {quote.client.companyName ?? quote.client.contactName}
              </Link>
              {' · '}
              {quote.client.clientNumber}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn('border-transparent', STATUS_BADGE[quote.status])}
            >
              {QUOTE_STATUS_LABELS[quote.status]}
            </Badge>
            <Badge variant="outline">
              <BadgeDollarSign className="mr-1 h-3.5 w-3.5" />
              {quote.totalAmount.toLocaleString()} SAR
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {quote.status === 'DRAFT' && (
          <Button
            size="sm"
            onClick={() =>
              callMutation('Submitted', () => submitMutation.mutateAsync({}))
            }
            disabled={submitMutation.isPending}
          >
            <FileText className="mr-2 h-4 w-4" /> Submit for approval
          </Button>
        )}
        {quote.status === 'APPROVED' && (
          <Button
            size="sm"
            onClick={() =>
              callMutation('Sent to client', () => sendMutation.mutateAsync())
            }
            disabled={sendMutation.isPending}
          >
            <Send className="mr-2 h-4 w-4" /> Send to client
          </Button>
        )}
        {(['SENT', 'VIEWED', 'UNDER_NEGOTIATION'] as QuoteStatus[]).includes(
          quote.status,
        ) && (
          <>
            <Button
              size="sm"
              onClick={() =>
                callMutation('Accepted', () => acceptMutation.mutateAsync())
              }
              disabled={acceptMutation.isPending}
            >
              <ThumbsUp className="mr-2 h-4 w-4" /> Mark accepted
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => setRejectOpen(true)}
            >
              <ThumbsDown className="mr-2 h-4 w-4" /> Mark rejected
            </Button>
          </>
        )}
        {quote.purchaseOrder && (
          <Badge variant="outline">
            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
            PO {quote.purchaseOrder.poNumber}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>
                      {item.quantity} {item.unit ?? ''}
                    </TableCell>
                    <TableCell>{item.unitPrice.toLocaleString()} SAR</TableCell>
                    <TableCell>{item.discountPct}%</TableCell>
                    <TableCell className="text-right">
                      {item.subtotal.toLocaleString()} SAR
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Subtotal"
              value={`${quote.subtotal.toLocaleString()} SAR`}
            />
            <Row
              label={`Discount${quote.discountType === 'PERCENTAGE' ? ` (${quote.discountValue}%)` : ''}`}
              value={`-${quote.discountAmount.toLocaleString()} SAR`}
            />
            <Row
              label={`Tax (${quote.taxRate}%)`}
              value={`${quote.taxAmount.toLocaleString()} SAR`}
            />
            <div className="border-t pt-2">
              <Row
                label="Total"
                value={`${quote.totalAmount.toLocaleString()} SAR`}
                bold
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {quote.paymentMilestones.length === 0 && (
              <p className="text-muted-foreground">No milestones configured.</p>
            )}
            {quote.paymentMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-medium">{milestone.description}</div>
                  {milestone.daysFromStart !== null && (
                    <div className="text-xs text-muted-foreground">
                      {milestone.daysFromStart} days from start
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div>{milestone.percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {milestone.amount.toLocaleString()} SAR
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quote.approvals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No approvals required at this amount.
              </p>
            )}
            {quote.approvals.map((approval) => {
              const isMine =
                user?.id === approval.approver.id &&
                approval.status === 'PENDING';
              const approverName =
                [approval.approver.firstName, approval.approver.lastName]
                  .filter(Boolean)
                  .join(' ') || approval.approver.email;
              return (
                <div
                  key={approval.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      Tier {approval.tier} — {approverName}
                    </div>
                    {approval.comments && (
                      <div className="text-xs text-muted-foreground">
                        {approval.comments}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'border-transparent',
                        approval.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : approval.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {approval.status}
                    </Badge>
                    {isMine && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            callMutation('Approved', () =>
                              decideMutation.mutateAsync({
                                approvalId: approval.id,
                                status: 'APPROVED',
                              }),
                            )
                          }
                          disabled={decideMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() =>
                            callMutation('Rejected', () =>
                              decideMutation.mutateAsync({
                                approvalId: approval.id,
                                status: 'REJECTED',
                              }),
                            )
                          }
                          disabled={decideMutation.isPending}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row
              label="Prepared by"
              value={
                quote.preparedBy
                  ? [quote.preparedBy.firstName, quote.preparedBy.lastName]
                      .filter(Boolean)
                      .join(' ') || quote.preparedBy.email
                  : null
              }
            />
            <Row
              label="Valid until"
              value={
                quote.validUntil
                  ? format(new Date(quote.validUntil), 'PP')
                  : null
              }
            />
            <Row label="Payment terms" value={quote.paymentTerms} />
            <Row label="Delivery timeline" value={quote.deliveryTimeline} />
            <Row
              label="Sent at"
              value={
                quote.sentAt ? format(new Date(quote.sentAt), 'PPp') : null
              }
            />
            <Row
              label="Accepted at"
              value={
                quote.acceptedAt
                  ? format(new Date(quote.acceptedAt), 'PPp')
                  : null
              }
            />
            {quote.rejectedReason && (
              <Row label="Rejected reason" value={quote.rejectedReason} />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject quote</DialogTitle>
            <DialogDescription>
              Optionally record why the client rejected this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const result = await callMutation('Rejected', () =>
                  rejectMutation.mutateAsync({
                    reason: rejectReason.trim() || undefined,
                  }),
                );
                if (result) {
                  setRejectOpen(false);
                  setRejectReason('');
                }
              }}
              disabled={rejectMutation.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string | null | undefined;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-right',
          bold && 'text-base font-semibold text-abak-blue',
        )}
      >
        {value && value !== '' ? value : '—'}
      </span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/quotes"
      className="inline-flex items-center gap-1 text-sm text-abak-blue hover:underline"
    >
      <ArrowLeft className="h-4 w-4" /> Back to quotes
    </Link>
  );
}
