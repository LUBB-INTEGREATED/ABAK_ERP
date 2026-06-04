'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  BadgeCheck,
  FileText,
  FolderPlus,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Printer,
  Scale,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuoteStatusBadge } from '@/components/ui/entity-status-badges';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  DetailBody,
  DetailError,
  DetailHeader,
  DetailRail,
  DetailSection,
  DetailSkeleton,
  Field,
  FieldGrid,
  RailStat,
} from '@/components/detail/detail-shell';
import {
  useAcceptQuote,
  useConvertQuoteToProject,
  useDecideApproval,
  useQuote,
  useQuoteSections,
  useRejectQuote,
  useSendQuote,
  useSetInDiscussion,
  useSetInNegotiation,
  useSubmitQuote,
} from '@/lib/hooks/use-quotes';
import { CompileView } from '@/components/quotations/compile-view';
import { useAuthStore } from '@/lib/auth';
import {
  LOSS_REASONS,
  type LossReason,
  type QuoteStatus,
} from '@/lib/types/quote';

const BACK_HREF = '/quotes';

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations();
  const tQ = useTranslations('quoteDetail');
  const td = useTranslations('detail');
  const BACK_LABEL = td('backToQuotes');
  const { data: quote, isLoading, isError, error } = useQuote(id);
  const user = useAuthStore((state) => state.user);
  const submitMutation = useSubmitQuote(id);
  const sendMutation = useSendQuote(id);
  const acceptMutation = useAcceptQuote(id);
  const convertMutation = useConvertQuoteToProject(id);
  const rejectMutation = useRejectQuote(id);
  const decideMutation = useDecideApproval(id);
  const inDiscussionMutation = useSetInDiscussion(id);
  const inNegotiationMutation = useSetInNegotiation(id);
  // QP-6: a lead-reviewer quote (has department sections) drives its §14 submit
  // from the compile view below, so the generic header submit is suppressed.
  const sectionsQuery = useQuoteSections(id);
  const hasSections = (sectionsQuery.data?.length ?? 0) > 0;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonCode, setRejectReasonCode] = useState<LossReason>('OTHER');

  if (isLoading) return <DetailSkeleton />;
  if (isError || !quote) {
    return (
      <DetailError
        backHref={BACK_HREF}
        backLabel={BACK_LABEL}
        message={error instanceof Error ? error.message : tQ('notFound')}
      />
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
          ?.response?.data?.message ?? tQ('actionFailed');
      toast.error(
        Array.isArray(message) ? message.join(', ') : String(message),
      );
      return null;
    }
  }

  // Status-driven flags — gating preserved exactly as the original toolbar.
  const canReviewing = quote.status === 'SENT';
  const canNegotiating = (['SENT', 'IN_DISCUSSION'] as QuoteStatus[]).includes(
    quote.status,
  );
  const canDecide = (
    ['SENT', 'IN_DISCUSSION', 'IN_NEGOTIATION'] as QuoteStatus[]
  ).includes(quote.status);

  const preparedByName = quote.preparedBy
    ? [quote.preparedBy.firstName, quote.preparedBy.lastName]
        .filter(Boolean)
        .join(' ') || quote.preparedBy.email
    : null;

  // Surface to an approver that the ball is in their court.
  const isApprover = quote.approvals.some(
    (a) => user?.id === a.approver.id && a.status === 'PENDING',
  );

  // The single most important next action, gated by quote.status.
  const primary =
    quote.status === 'DRAFT' && !hasSections ? (
      <Button
        size="sm"
        onClick={() =>
          callMutation(tQ('submittedToast'), () =>
            submitMutation.mutateAsync({}),
          )
        }
        disabled={submitMutation.isPending}
      >
        <FileText className="me-2 h-4 w-4" /> {tQ('submitForApproval')}
      </Button>
    ) : quote.status === 'APPROVED' ? (
      <Button
        size="sm"
        onClick={() =>
          callMutation(tQ('sentToClientToast'), () =>
            sendMutation.mutateAsync(),
          )
        }
        disabled={sendMutation.isPending}
      >
        <Send className="me-2 h-4 w-4" /> {tQ('sendToClient')}
      </Button>
    ) : canDecide ? (
      <Button
        size="sm"
        onClick={() =>
          callMutation(tQ('acceptedToast'), () => acceptMutation.mutateAsync())
        }
        disabled={acceptMutation.isPending}
      >
        <ThumbsUp className="me-2 h-4 w-4" /> {tQ('markAccepted')}
      </Button>
    ) : quote.status === 'WON' ? (
      // 1-click conversion: Won → Project. Department Manager surface
      // (2026-05-21 process correction). Visible only on WON quotes that
      // don't yet have a project.
      <Button
        size="sm"
        variant="default"
        onClick={async () => {
          const project = await callMutation(tQ('convertedToast'), () =>
            convertMutation.mutateAsync({}),
          );
          if (project?.id) {
            window.location.href = `/projects/${project.id}`;
          }
        }}
        disabled={convertMutation.isPending}
      >
        <FolderPlus className="me-2 h-4 w-4" />
        {convertMutation.isPending ? tQ('converting') : tQ('convertToProject')}
      </Button>
    ) : undefined;

  // Has any destructive / read-only items for the overflow menu?
  const hasMenu = canDecide || Boolean(quote.purchaseOrder);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={BACK_HREF}
        backLabel={BACK_LABEL}
        eyebrow={
          <>
            {quote.quoteNumber}
            {quote.version > 1 && ` (v${quote.version})`}
          </>
        }
        title={quote.title}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Link
              href={`/clients/${quote.client.id}`}
              className="text-abak-blue hover:underline"
            >
              {quote.client.companyName ?? quote.client.contactName}
            </Link>
            {' · '}
            {quote.client.clientNumber}
          </span>
        }
        badges={
          <>
            <QuoteStatusBadge status={quote.status} size="md" />
            {isApprover && (
              <Badge className="border-transparent bg-amber-100 text-amber-700">
                <ShieldCheck className="me-1 h-3.5 w-3.5" />{' '}
                {tQ('awaitingYourApproval')}
              </Badge>
            )}
          </>
        }
        primary={primary}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/quotes/${id}/print`} target="_blank" rel="noopener">
                <Printer className="me-2 h-4 w-4" />{' '}
                {t('quotePdf.previewButton')}
              </Link>
            </Button>
            {canReviewing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  callMutation(tQ('clientReviewing'), () =>
                    inDiscussionMutation.mutateAsync(),
                  )
                }
                disabled={inDiscussionMutation.isPending}
              >
                <MessageSquare className="me-2 h-4 w-4" />{' '}
                {tQ('clientReviewing')}
              </Button>
            )}
            {canNegotiating && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  callMutation(tQ('negotiating'), () =>
                    inNegotiationMutation.mutateAsync(),
                  )
                }
                disabled={inNegotiationMutation.isPending}
              >
                <Scale className="me-2 h-4 w-4" /> {tQ('negotiating')}
              </Button>
            )}
          </>
        }
        menu={
          hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={td('moreActions')}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {quote.purchaseOrder && (
                  <DropdownMenuLabel className="flex items-center font-normal text-muted-foreground">
                    <BadgeCheck className="me-2 h-4 w-4" />
                    {tQ('poLabel', { number: quote.purchaseOrder.poNumber })}
                  </DropdownMenuLabel>
                )}
                {quote.purchaseOrder && canDecide && <DropdownMenuSeparator />}
                {canDecide && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      setRejectOpen(true);
                    }}
                  >
                    <ThumbsDown className="me-2 h-4 w-4" /> {tQ('markRejected')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      <DetailBody
        rail={
          <>
            <DetailRail title={td('totals')}>
              <RailStat
                label={td('total')}
                value={`${quote.totalAmount.toLocaleString()} ${tQ('currency')}`}
                tone="success"
              />
              <FieldGrid cols={1}>
                <Field
                  label={td('subtotal')}
                  emphasis="money"
                  value={`${quote.subtotal.toLocaleString()} ${tQ('currency')}`}
                />
                <Field
                  label={`${td('discount')}${quote.discountType === 'PERCENTAGE' ? ` (${quote.discountValue}%)` : ''}`}
                  emphasis="money"
                  value={`-${quote.discountAmount.toLocaleString()} ${tQ('currency')}`}
                />
                <Field
                  label={`${td('vat')} (${quote.taxRate}%)`}
                  emphasis="money"
                  value={`${quote.taxAmount.toLocaleString()} ${tQ('currency')}`}
                />
              </FieldGrid>
            </DetailRail>

            <DetailRail title={td('atAGlance')}>
              <FieldGrid cols={1}>
                <Field label={td('status')}>
                  <QuoteStatusBadge status={quote.status} size="md" />
                </Field>
                <Field
                  label={td('validUntil')}
                  emphasis="strong"
                  value={
                    quote.validUntil
                      ? format(new Date(quote.validUntil), 'PP')
                      : null
                  }
                />
                <Field label={td('preparedBy')} value={preparedByName} />
                <Field label={td('paymentTerms')} value={quote.paymentTerms} />
                <Field
                  label={td('deliveryTimeline')}
                  value={quote.deliveryTimeline}
                />
                <Field label={td('client')}>
                  <Link
                    href={`/clients/${quote.client.id}`}
                    className="text-abak-blue hover:underline"
                  >
                    {quote.client.companyName ?? quote.client.contactName}
                  </Link>
                </Field>
              </FieldGrid>
            </DetailRail>

            <DetailRail title={td('record')}>
              <FieldGrid cols={1}>
                <Field
                  label={td('sentAt')}
                  emphasis="muted"
                  value={
                    quote.sentAt ? format(new Date(quote.sentAt), 'PPp') : null
                  }
                />
                <Field
                  label={td('wonAt')}
                  emphasis="muted"
                  value={
                    quote.wonAt ? format(new Date(quote.wonAt), 'PPp') : null
                  }
                />
                {quote.lostReason && (
                  <Field label={td('lostReason')} value={quote.lostReason} />
                )}
              </FieldGrid>
            </DetailRail>
          </>
        }
      >
        {hasSections && (
          <section className="rounded-lg border bg-card p-4">
            <CompileView quote={quote} currentUserId={user?.id} />
          </section>
        )}

        <DetailSection
          title={td('lineItems')}
          icon={ListChecks}
          bodyPadded={false}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tQ('description')}</TableHead>
                <TableHead>{tQ('qty')}</TableHead>
                <TableHead>{tQ('unitPrice')}</TableHead>
                <TableHead>{td('discount')}</TableHead>
                <TableHead className="text-end">{td('subtotal')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>{item.description}</div>
                    {item.department && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {item.department.nameAr ?? item.department.name}
                      </Badge>
                    )}
                    {item.methodologyCard?.deliverable && (
                      <div className="mt-1 text-xs text-abak-blue/80">
                        ✓ {item.methodologyCard.deliverable}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.quantity} {item.unit ?? ''}
                  </TableCell>
                  <TableCell>
                    {item.unitPrice.toLocaleString()} {tQ('currency')}
                  </TableCell>
                  <TableCell>{item.discountPct}%</TableCell>
                  <TableCell className="text-end">
                    {item.subtotal.toLocaleString()} {tQ('currency')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DetailSection>

        <DetailSection title={td('paymentSchedule')}>
          <div className="space-y-2 text-sm">
            {quote.paymentMilestones.length === 0 && (
              <p className="text-muted-foreground">{tQ('noMilestones')}</p>
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
                      {tQ('daysFromStart', { days: milestone.daysFromStart })}
                    </div>
                  )}
                </div>
                <div className="text-end">
                  <div>{milestone.percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {milestone.amount.toLocaleString()} {tQ('currency')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>

        {(quote.scopeOfWork ||
          quote.deliverables ||
          quote.exclusions ||
          quote.assumptions ||
          quote.numberOfRevisions !== null) && (
          <DetailSection title={tQ('technicalScope')}>
            <div className="space-y-3 text-sm">
              {quote.scopeOfWork && (
                <ScopeRow label={tQ('scopeOfWork')} value={quote.scopeOfWork} />
              )}
              {quote.deliverables && (
                <ScopeRow
                  label={tQ('deliverables')}
                  value={quote.deliverables}
                />
              )}
              {quote.exclusions && (
                <ScopeRow label={tQ('exclusions')} value={quote.exclusions} />
              )}
              {quote.assumptions && (
                <ScopeRow label={tQ('assumptions')} value={quote.assumptions} />
              )}
              {quote.numberOfRevisions !== null && (
                <ScopeRow
                  label={tQ('reviewRounds')}
                  value={String(quote.numberOfRevisions)}
                />
              )}
            </div>
          </DetailSection>
        )}

        <DetailSection title={td('approvals')} icon={ShieldCheck}>
          <div className="space-y-3">
            {quote.approvals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {tQ('noApprovalsRequired')}
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
                      {tQ('tierLabel', { tier: approval.tier })} —{' '}
                      {approverName}
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
                      {tQ(`approvalStatus.${approval.status}`)}
                    </Badge>
                    {isMine && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            callMutation(tQ('approvedToast'), () =>
                              decideMutation.mutateAsync({
                                approvalId: approval.id,
                                status: 'APPROVED',
                              }),
                            )
                          }
                          disabled={decideMutation.isPending}
                        >
                          {tQ('approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() =>
                            callMutation(tQ('rejectedToast'), () =>
                              decideMutation.mutateAsync({
                                approvalId: approval.id,
                                status: 'REJECTED',
                              }),
                            )
                          }
                          disabled={decideMutation.isPending}
                        >
                          {tQ('reject')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DetailSection>
      </DetailBody>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tQ('rejectQuoteTitle')}</DialogTitle>
            <DialogDescription>{tQ('rejectQuoteDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="reasonCode">{tQ('reasonCode')}</Label>
              <select
                id="reasonCode"
                value={rejectReasonCode}
                onChange={(e) =>
                  setRejectReasonCode(e.target.value as LossReason)
                }
                className="input-base"
              >
                {LOSS_REASONS.map((code) => (
                  <option key={code} value={code}>
                    {tQ(`lossReason.${code}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">{tQ('notesOptional')}</Label>
              <Textarea
                id="reason"
                rows={3}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {td('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const result = await callMutation(tQ('markedLostToast'), () =>
                  rejectMutation.mutateAsync({
                    reasonCode: rejectReasonCode,
                    reason: rejectReason.trim() || undefined,
                  }),
                );
                if (result) {
                  setRejectOpen(false);
                  setRejectReason('');
                  setRejectReasonCode('OTHER');
                }
              }}
              disabled={rejectMutation.isPending}
            >
              {tQ('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScopeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1" dir="rtl">
      <div className="font-medium text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap text-sm">{value}</div>
    </div>
  );
}
