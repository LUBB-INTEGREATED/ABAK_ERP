'use client';

import { use } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { QuoteStatusBadge } from '@/components/ui/entity-status-badges';
import { useQuote } from '@/lib/hooks/use-quotes';
import type { PaymentMilestone, QuoteItem } from '@/lib/types/quote';

export default function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: quote, isLoading, isError } = useQuote(id);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-64 w-full animate-pulse rounded bg-muted" />
      </main>
    );
  }

  if (isError || !quote) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm text-rose-700">{t('quotePdf.loadError')}</p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
          {t('common.back')}
        </Button>
      </main>
    );
  }

  const issuedAt = quote.createdAt.slice(0, 10);
  const validUntil = quote.validUntil?.slice(0, 10);

  return (
    <>
      {/* Toolbar — hidden when printing */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link
            href={`/quotes/${id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-dark-text"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t('quotePdf.backToQuote')}
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t('quotePdf.printHint')}
            </span>
            <Button onClick={() => window.print()}>
              <Printer className="me-2 h-4 w-4" />
              {t('quotePdf.printOrSave')}
            </Button>
          </div>
        </div>
      </header>

      {/* Document */}
      <main className="mx-auto max-w-4xl bg-white px-10 py-12 text-dark-text print:max-w-none print:px-0 print:py-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b pb-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.jpg"
              alt="ABAK"
              width={56}
              height={56}
              className="rounded"
            />
            <div>
              <div className="text-lg font-bold text-abak-blue">
                {t('common.appName')}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('common.appTagline')}
              </div>
            </div>
          </div>
          <div className="text-end">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('quotePdf.documentType')}
            </div>
            <div
              className="font-mono text-lg font-bold text-abak-blue"
              dir="ltr"
            >
              {quote.quoteNumber}
            </div>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>v{quote.version}</span>
              <span>·</span>
              <QuoteStatusBadge status={quote.status} />
            </div>
          </div>
        </div>

        {/* Header meta */}
        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <SectionLabel>{t('quotePdf.preparedFor')}</SectionLabel>
            <div className="mt-1 text-sm font-semibold">
              {quote.client.companyName ?? quote.client.contactName}
            </div>
            {quote.client.companyName && (
              <div className="text-xs text-muted-foreground">
                {t('quotePdf.attn')}: {quote.client.contactName}
              </div>
            )}
            <div
              className="mt-0.5 font-mono text-[11px] text-muted-foreground"
              dir="ltr"
            >
              {quote.client.clientNumber}
            </div>
          </div>
          <div>
            <SectionLabel>{t('quotePdf.dates')}</SectionLabel>
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              <span className="text-muted-foreground">
                {t('quotePdf.issued')}:
              </span>
              <span className="font-mono" dir="ltr">
                {issuedAt}
              </span>
              {validUntil && (
                <>
                  <span className="text-muted-foreground">
                    {t('quotePdf.validUntil')}:
                  </span>
                  <span className="font-mono" dir="ltr">
                    {validUntil}
                  </span>
                </>
              )}
              {quote.preparedBy && (
                <>
                  <span className="text-muted-foreground">
                    {t('quotePdf.preparedBy')}:
                  </span>
                  <span>
                    {[quote.preparedBy.firstName, quote.preparedBy.lastName]
                      .filter(Boolean)
                      .join(' ') || quote.preparedBy.email}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Title */}
        <section className="mt-8">
          <h1 className="text-2xl font-bold text-abak-blue">{quote.title}</h1>
          {quote.description && (
            <p className="mt-2 text-sm leading-relaxed text-dark-text/80">
              {quote.description}
            </p>
          )}
        </section>

        {/* Scope of work */}
        {quote.scopeOfWork && (
          <Block label={t('quotePdf.scopeOfWork')} body={quote.scopeOfWork} />
        )}
        {quote.deliverables && (
          <Block label={t('quotePdf.deliverables')} body={quote.deliverables} />
        )}
        {quote.exclusions && (
          <Block label={t('quotePdf.exclusions')} body={quote.exclusions} />
        )}
        {quote.assumptions && (
          <Block label={t('quotePdf.assumptions')} body={quote.assumptions} />
        )}

        {/* Line items */}
        <section className="mt-8">
          <SectionLabel>{t('quotePdf.lineItems')}</SectionLabel>
          <ItemsTable items={quote.items} />
        </section>

        {/* Totals */}
        <section className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <TotalRow label={t('quotePdf.subtotal')} value={quote.subtotal} />
            {quote.discountAmount > 0 && (
              <TotalRow
                label={t('quotePdf.discount')}
                value={-quote.discountAmount}
              />
            )}
            {quote.taxAmount > 0 && (
              <TotalRow
                label={`${t('quotePdf.tax')} (${quote.taxRate}%)`}
                value={quote.taxAmount}
              />
            )}
            <div className="mt-1 flex justify-between border-t pt-2 text-base font-bold text-abak-blue">
              <span>{t('quotePdf.total')}</span>
              <span className="font-mono tabular-nums" dir="ltr">
                {formatMoney(quote.totalAmount)} {t('units.sar')}
              </span>
            </div>
          </div>
        </section>

        {/* Payment schedule */}
        {quote.paymentMilestones.length > 0 && (
          <section className="mt-8">
            <SectionLabel>{t('quotePdf.paymentSchedule')}</SectionLabel>
            <MilestonesTable
              milestones={quote.paymentMilestones}
              total={quote.totalAmount}
            />
          </section>
        )}

        {/* Terms */}
        {quote.deliveryTimeline && (
          <Block
            label={t('quotePdf.deliveryTimeline')}
            body={quote.deliveryTimeline}
          />
        )}
        {quote.paymentTerms && (
          <Block label={t('quotePdf.paymentTerms')} body={quote.paymentTerms} />
        )}
        {quote.termsAndConditions && (
          <Block
            label={t('quotePdf.termsAndConditions')}
            body={quote.termsAndConditions}
          />
        )}
        {quote.clientNotes && (
          <Block label={t('quotePdf.notes')} body={quote.clientNotes} />
        )}

        {/* Footer */}
        <footer className="mt-12 border-t pt-4 text-center text-[10px] text-muted-foreground">
          {t('quotePdf.footer', { quoteNumber: quote.quoteNumber })}
        </footer>
      </main>

      {/* Print stylesheet — letterhead-friendly */}
      <style jsx global>{`
        @page {
          size: A4;
          margin: 16mm 14mm;
        }
        @media print {
          html,
          body {
            background: white !important;
          }
          /* Avoid splitting tables awkwardly */
          table {
            break-inside: auto;
          }
          tr {
            break-inside: avoid;
            break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <section className="mt-6">
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-dark-text/80">
        {body}
      </p>
    </section>
  );
}

function ItemsTable({ items }: { items: QuoteItem[] }) {
  const t = useTranslations();
  if (items.length === 0) {
    return (
      <div className="mt-2 rounded border bg-muted/20 p-3 text-xs text-muted-foreground">
        {t('quotePdf.noItems')}
      </div>
    );
  }
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-abak-blue/30 text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="py-2 text-start font-medium">#</th>
          <th className="py-2 text-start font-medium">
            {t('quotePdf.itemDescription')}
          </th>
          <th className="py-2 text-end font-medium">{t('quotePdf.qty')}</th>
          <th className="py-2 text-end font-medium">{t('quotePdf.unit')}</th>
          <th className="py-2 text-end font-medium">
            {t('quotePdf.unitPrice')}
          </th>
          <th className="py-2 text-end font-medium">{t('quotePdf.amount')}</th>
        </tr>
      </thead>
      <tbody>
        {items
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((item, idx) => (
            <tr key={item.id} className="border-b last:border-0 align-top">
              <td
                className="py-2 font-mono text-xs text-muted-foreground"
                dir="ltr"
              >
                {idx + 1}
              </td>
              <td className="py-2 pe-3">
                <div className="font-medium">{item.description}</div>
                {item.notes && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.notes}
                  </div>
                )}
              </td>
              <td className="py-2 text-end font-mono tabular-nums" dir="ltr">
                {item.quantity}
              </td>
              <td className="py-2 text-end text-xs text-muted-foreground">
                {item.unit ?? '—'}
              </td>
              <td className="py-2 text-end font-mono tabular-nums" dir="ltr">
                {formatMoney(item.unitPrice)}
              </td>
              <td
                className="py-2 text-end font-mono font-medium tabular-nums"
                dir="ltr"
              >
                {formatMoney(item.subtotal)}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function MilestonesTable({
  milestones,
  total,
}: {
  milestones: PaymentMilestone[];
  total: number;
}) {
  const t = useTranslations();
  return (
    <table className="mt-2 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-abak-blue/30 text-[11px] uppercase tracking-wide text-muted-foreground">
          <th className="py-2 text-start font-medium">#</th>
          <th className="py-2 text-start font-medium">
            {t('quotePdf.milestone')}
          </th>
          <th className="py-2 text-end font-medium">%</th>
          <th className="py-2 text-end font-medium">{t('quotePdf.amount')}</th>
          <th className="py-2 text-end font-medium">
            {t('quotePdf.daysFromStart')}
          </th>
        </tr>
      </thead>
      <tbody>
        {milestones
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((m, idx) => (
            <tr key={m.id} className="border-b last:border-0">
              <td
                className="py-2 font-mono text-xs text-muted-foreground"
                dir="ltr"
              >
                {idx + 1}
              </td>
              <td className="py-2 pe-3 font-medium">{m.description}</td>
              <td className="py-2 text-end font-mono tabular-nums" dir="ltr">
                {m.percentage}%
              </td>
              <td className="py-2 text-end font-mono tabular-nums" dir="ltr">
                {formatMoney((m.percentage / 100) * total)}
              </td>
              <td
                className="py-2 text-end text-xs text-muted-foreground"
                dir="ltr"
              >
                {m.daysFromStart ?? '—'}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  const t = useTranslations();
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums" dir="ltr">
        {formatMoney(value)} {t('units.sar')}
      </span>
    </div>
  );
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
