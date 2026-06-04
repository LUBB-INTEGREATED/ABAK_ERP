'use client';

import { use } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRfq } from '@/lib/hooks/use-rfqs';
import type { RfqDetail, RfqDisplayStatus } from '@/lib/types/rfq';
import { RequestPhaseBadge } from '@/components/ui/entity-status-badges';
import { OpenAsksCard } from '@/components/rfqs/open-asks-card';
import { RerouteCard } from '@/components/rfqs/reroute-card';
import { QuoteActionCard } from '@/components/rfqs/quote-action-card';
import {
  DetailHeader,
  DetailBody,
  DetailSection,
  DetailRail,
  RailStat,
  DetailSkeleton,
  DetailError,
  FieldGrid,
  Field,
} from '@/components/detail/detail-shell';
import { cn } from '@/lib/utils';

// SALES-2 — single-scroll tracker. The rep reads top→bottom: where is it →
// what does it want from me → here's the quote → record the result. Sales sees
// ZERO assign/pricing controls (role-gated by construction — none rendered).

const STEPS = ['submitted', 'pricing', 'quoteReady', 'sent', 'closed'] as const;
type Step = (typeof STEPS)[number];

function stepIndex(d: RfqDisplayStatus): number {
  switch (d) {
    case 'SUBMITTED':
      return 0;
    case 'PRICING':
    case 'IN_APPROVAL':
      return 1;
    case 'QUOTE_READY':
      return 2;
    case 'SENT':
      return 3;
    case 'WON':
    case 'LOST':
    case 'POSTPONED':
      return 4;
    default:
      return 0;
  }
}

function StatusTimeline({ rfq }: { rfq: RfqDetail }) {
  const t = useTranslations('rfq.tracker');
  const d = rfq.displayStatus;

  if (d === 'DECLINED_WRONG_DEPT' || d === 'DECLINED_NO_BID') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        {d === 'DECLINED_NO_BID'
          ? t('timeline.noBid')
          : t('timeline.passedBack')}
      </div>
    );
  }
  if (d === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        <span className="text-rose-500">✕</span>
        {t('timeline.cancelled')}
      </div>
    );
  }

  const current = stepIndex(d);
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((s: Step, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'h-3 w-3 rounded-full',
                  done && 'bg-abak-blue',
                  now &&
                    'bg-amber-500 ring-4 ring-amber-200 motion-reduce:ring-2',
                  !done && !now && 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'whitespace-nowrap text-[11px]',
                  now ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {t(`timeline.${s}`)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  'h-px flex-1',
                  i < current ? 'bg-abak-blue' : 'bg-muted',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function QuoteSection({ rfqId, rfq }: { rfqId: string; rfq: RfqDetail }) {
  const t = useTranslations('rfq.tracker.quote');
  // No quote yet → calm "still being worked up". Otherwise hand off to the
  // action card (SALES-4: send / record outcome, permission-gated).
  if (!rfq.quote) {
    return (
      <DetailSection title={t('title')}>
        <p className="text-sm text-muted-foreground">{t('notYet')}</p>
      </DetailSection>
    );
  }
  return <QuoteActionCard rfqId={rfqId} quoteId={rfq.quote.id} />;
}

export default function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations('rfq.tracker');
  const locale = useLocale();
  const { data: rfq, isLoading, isError } = useRfq(id);

  if (isLoading)
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <DetailSkeleton />
      </div>
    );
  if (isError || !rfq)
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <DetailError
          backHref="/rfqs"
          backLabel={t('back')}
          message={t('notFound')}
        />
      </div>
    );

  const clientName = rfq.client?.companyName ?? rfq.client?.contactName ?? '—';
  const raisedOn = new Date(rfq.createdAt).toLocaleDateString(
    locale === 'ar' ? 'ar-SA' : 'en-GB',
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <DetailHeader
        backHref="/rfqs"
        backLabel={t('back')}
        eyebrow={
          rfq.quote
            ? `${rfq.quote.quoteNumber} · ${t('fromRfq', { rfq: rfq.rfqNumber })}`
            : rfq.rfqNumber
        }
        title={clientName}
        subtitle={rfq.client?.contactName ?? undefined}
        badges={<RequestPhaseBadge status={rfq.displayStatus} />}
      />

      <div className="mt-6">
        <DetailBody
          rail={
            <DetailRail title={t('rail.title')}>
              {rfq.quote && (
                <RailStat
                  tone="brand"
                  label={t('rail.quoteTotal')}
                  value={`${rfq.quote.totalAmount.toLocaleString('en-US')} ${t('quote.sar')}`}
                />
              )}
              <Field label={t('rail.client')}>{clientName}</Field>
              {rfq.client?.contactName && (
                <Field label={t('rail.contact')}>
                  {rfq.client.contactName}
                </Field>
              )}
              <Field label={t('rail.raisedOn')}>{raisedOn}</Field>
            </DetailRail>
          }
        >
          {/* ⓿ REROUTE — self-hides unless the request came back declined (SALES-5) */}
          <RerouteCard rfq={rfq} />

          {/* ① OPEN ASKS — self-hides when nothing is owed (SALES-3) */}
          <OpenAsksCard rfqId={id} />

          {/* ② STATUS TIMELINE */}
          <DetailSection title={t('status')}>
            <StatusTimeline rfq={rfq} />
          </DetailSection>

          {/* ③ REQUEST SUMMARY (read-only) */}
          <DetailSection title={t('summary.title')}>
            <FieldGrid>
              <Field label={t('summary.services')}>{rfq.serviceType}</Field>
              <Field label={t('summary.scope')}>
                <span className="whitespace-pre-wrap">{rfq.projectScope}</span>
              </Field>
              {rfq.brokerName && (
                <Field label={t('summary.broker')}>
                  {rfq.brokerName}
                  {rfq.brokerPhone ? ` · ${rfq.brokerPhone}` : ''}
                </Field>
              )}
            </FieldGrid>
          </DetailSection>

          {/* ④ QUOTE */}
          <QuoteSection rfqId={id} rfq={rfq} />
        </DetailBody>
      </div>
    </div>
  );
}
