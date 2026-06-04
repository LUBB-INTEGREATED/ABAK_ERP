'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Trophy, CalendarClock, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  useQuote,
  useSendQuote,
  useAcceptQuote,
  useRejectQuote,
  usePostponeQuote,
  useSetInDiscussion,
  useSetInNegotiation,
} from '@/lib/hooks/use-quotes';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { LOSS_REASONS, type LossReason } from '@/lib/types/quote';
import { DetailSection } from '@/components/detail/detail-shell';
import { cn } from '@/lib/utils';

// SALES-4 — the quote card's action layer. The rep's two moves: SEND an approved
// quote to the client (quote:send), then RECORD the outcome once the client
// replies — Won/Lost/Postpone (quote:set_outcome). Both are permission-gated, so
// a pricing engineer opening this tracker sees the figure but never these
// controls (§5 matrix). Closed quotes render their outcome read-only.

type Mode = null | 'send' | 'won' | 'lost' | 'postpone';

const PRIMARY =
  'inline-flex min-h-[44px] items-center gap-2 rounded-md bg-abak-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const OUTLINE =
  'inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-50';

export function QuoteActionCard({
  rfqId: _rfqId,
  quoteId,
}: {
  rfqId: string;
  quoteId: string;
}) {
  const t = useTranslations('rfq.tracker.quote');
  const tStatus = useTranslations('quote.status');
  const tLoss = useTranslations('quoteDetail.lossReason');
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = usePermissions();

  const { data: quote, isLoading } = useQuote(quoteId);
  const send = useSendQuote(quoteId);
  const accept = useAcceptQuote(quoteId);
  const reject = useRejectQuote(quoteId);
  const postpone = usePostponeQuote(quoteId);
  const inDiscussion = useSetInDiscussion(quoteId);
  const inNegotiation = useSetInNegotiation(quoteId);

  const [mode, setMode] = useState<Mode>(null);
  const [lossCode, setLossCode] = useState<LossReason>('PRICE');
  const [lossNote, setLossNote] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const busy =
    send.isPending ||
    accept.isPending ||
    reject.isPending ||
    postpone.isPending ||
    inDiscussion.isPending ||
    inNegotiation.isPending;

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      // The rfq's display status + timeline derive from the quote, so refresh
      // the rfq queries too (the quote hooks only touch ['quotes']).
      await qc.invalidateQueries({ queryKey: ['rfqs'] });
      setMode(null);
    } catch {
      setError(t('error'));
    }
  }

  if (isLoading || !quote) {
    return (
      <DetailSection title={t('title')}>
        <div className="h-16 animate-pulse rounded bg-muted" />
      </DetailSection>
    );
  }

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB');

  const status = quote.status;
  const canSend = status === 'APPROVED' && can('quote:send');
  const canOutcome =
    ['SENT', 'IN_DISCUSSION', 'IN_NEGOTIATION'].includes(status) &&
    can('quote:set_outcome');
  const closed = ['WON', 'LOST', 'POSTPONED'].includes(status);

  return (
    <DetailSection title={t('title')}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="font-mono text-sm" dir="ltr">
            {quote.quoteNumber}
          </p>
          <p className="mt-1 text-lg font-bold text-abak-blue" dir="ltr">
            {fmt(quote.totalAmount)}{' '}
            <span className="text-sm font-normal">{t('sar')}</span>
          </p>
        </div>
        <Link
          href={`/quotes/${quote.id}`}
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/40"
        >
          {t('review')} ↗
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {/* APPROVED → send to client */}
        {canSend &&
          (mode === 'send' ? (
            <div className="space-y-3 rounded-md border border-abak-blue/30 bg-abak-blue/5 p-3">
              <p className="text-sm">
                {t('sendConfirm', {
                  client: quote.client.companyName ?? quote.client.contactName,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={busy}
                  onClick={() => run(() => send.mutateAsync())}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('confirmSend')}
                </button>
                <button
                  type="button"
                  className={OUTLINE}
                  disabled={busy}
                  onClick={() => setMode(null)}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={PRIMARY}
              onClick={() => setMode('send')}
            >
              <Send className="h-4 w-4" />
              {t('send')}
            </button>
          ))}

        {/* SENT → log client engagement (SALES-6) then record outcome */}
        {canOutcome && (
          <div className="space-y-3">
            <div className="space-y-2 border-b pb-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t('engagement')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(
                    'min-h-[44px] rounded-full border px-3 py-1.5 text-sm',
                    status === 'IN_DISCUSSION'
                      ? 'border-abak-blue bg-abak-blue/10 font-semibold text-abak-blue'
                      : 'hover:bg-muted/40',
                  )}
                  disabled={busy || status === 'IN_DISCUSSION'}
                  onClick={() => run(() => inDiscussion.mutateAsync())}
                >
                  {t('inDiscussion')}
                </button>
                <button
                  type="button"
                  className={cn(
                    'min-h-[44px] rounded-full border px-3 py-1.5 text-sm',
                    status === 'IN_NEGOTIATION'
                      ? 'border-abak-blue bg-abak-blue/10 font-semibold text-abak-blue'
                      : 'hover:bg-muted/40',
                  )}
                  disabled={busy || status === 'IN_NEGOTIATION'}
                  onClick={() => run(() => inNegotiation.mutateAsync())}
                >
                  {t('inNegotiation')}
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('recordOutcome')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(OUTLINE, 'border-success/40 text-success')}
                onClick={() => setMode(mode === 'won' ? null : 'won')}
              >
                <Trophy className="h-4 w-4" />
                {t('won')}
              </button>
              <button
                type="button"
                className={cn(OUTLINE, 'border-rose-300 text-rose-700')}
                onClick={() => setMode(mode === 'lost' ? null : 'lost')}
              >
                <XCircle className="h-4 w-4" />
                {t('lost')}
              </button>
              <button
                type="button"
                className={OUTLINE}
                onClick={() => setMode(mode === 'postpone' ? null : 'postpone')}
              >
                <CalendarClock className="h-4 w-4" />
                {t('postpone')}
              </button>
            </div>

            {mode === 'won' && (
              <div className="space-y-3 rounded-md border border-success/30 bg-success/5 p-3">
                <p className="text-sm">{t('wonConfirm')}</p>
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={busy}
                  onClick={() => run(() => accept.mutateAsync())}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('confirmWon')}
                </button>
              </div>
            )}

            {mode === 'lost' && (
              <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50/50 p-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('lostReasonLabel')}
                  </span>
                  <select
                    value={lossCode}
                    onChange={(e) => setLossCode(e.target.value as LossReason)}
                    disabled={busy}
                    className="block min-h-[44px] w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {LOSS_REASONS.map((code) => (
                      <option key={code} value={code}>
                        {tLoss(code)}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  value={lossNote}
                  onChange={(e) => setLossNote(e.target.value)}
                  placeholder={t('lostNotePlaceholder')}
                  rows={2}
                  dir="auto"
                  disabled={busy}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      reject.mutateAsync({
                        reasonCode: lossCode,
                        ...(lossNote.trim() ? { reason: lossNote.trim() } : {}),
                      }),
                    )
                  }
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('confirmLost')}
                </button>
              </div>
            )}

            {mode === 'postpone' && (
              <div className="space-y-3 rounded-md border p-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('postponeDateLabel')}
                  </span>
                  <input
                    type="date"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    disabled={busy}
                    dir="ltr"
                    className="block min-h-[44px] w-full rounded-md border bg-background px-3 text-sm"
                  />
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('postponeNotePlaceholder')}
                  rows={2}
                  dir="auto"
                  disabled={busy}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={busy || !followUp}
                  onClick={() =>
                    run(() =>
                      postpone.mutateAsync({
                        followUpDate: new Date(followUp).toISOString(),
                        ...(notes.trim() ? { notes: notes.trim() } : {}),
                      }),
                    )
                  }
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('confirmPostpone')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Closed outcomes — read-only */}
        {closed && (
          <div className="text-sm">
            {status === 'WON' && (
              <p className="flex items-center gap-2 font-semibold text-success">
                <Trophy className="h-4 w-4" />
                {tStatus('WON')}
              </p>
            )}
            {status === 'LOST' && (
              <p className="text-rose-700">
                {tStatus('LOST')}
                {quote.lostReasonCode
                  ? ` · ${tLoss(quote.lostReasonCode)}`
                  : ''}
                {quote.lostReason ? ` — ${quote.lostReason}` : ''}
              </p>
            )}
            {status === 'POSTPONED' && (
              <p className="text-muted-foreground">
                {tStatus('POSTPONED')}
                {quote.postponedUntil
                  ? ` · ${dateFmt(quote.postponedUntil)}`
                  : ''}
              </p>
            )}
          </div>
        )}

        {/* Quote exists but not yet actionable by sales (still being prepared) */}
        {!canSend && !canOutcome && !closed && (
          <p className="text-sm text-muted-foreground">{t('preparing')}</p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </DetailSection>
  );
}
