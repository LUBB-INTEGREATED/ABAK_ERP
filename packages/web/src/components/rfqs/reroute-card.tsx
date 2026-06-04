'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useRerouteRfq } from '@/lib/hooks/use-rfqs';
import { useDepartments } from '@/lib/hooks/use-rfq-assignments';
import type { RfqDetail } from '@/lib/types/rfq';
import { DetailSection } from '@/components/detail/detail-shell';
import { cn } from '@/lib/utils';

// SALES-5 (RV-24) — what the rep does when a request comes back declined.
//  • WRONG_DEPT → the request was routed to the wrong department. Show the
//    decline reason, let the rep fix the departments, and resubmit (reroute →
//    back to SUBMITTED). The backend rejects categories that map to no active
//    department-with-manager, so a bad pick surfaces as an inline error.
//  • NO_BID → the department looked and won't bid. Terminal; reason shown
//    read-only (the backend forbids reroute for NO_BID).
// Self-hides for every non-declined status.

export function RerouteCard({ rfq }: { rfq: RfqDetail }) {
  const t = useTranslations('rfq.tracker.reroute');
  const d = rfq.displayStatus;

  if (d === 'DECLINED_NO_BID') {
    return (
      <DetailSection title={t('title')} className="border-rose-300">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="font-medium">{t('noBidHeading')}</p>
            {rfq.declineReason && (
              <p className="mt-1 text-sm text-muted-foreground">
                {rfq.declineReason}
              </p>
            )}
          </div>
        </div>
      </DetailSection>
    );
  }

  if (d === 'DECLINED_WRONG_DEPT') return <RerouteForm rfq={rfq} />;
  return null;
}

function RerouteForm({ rfq }: { rfq: RfqDetail }) {
  const t = useTranslations('rfq.tracker.reroute');
  const locale = useLocale();
  const { data: cats = [], isLoading: catsLoading } = useDepartments();
  const reroute = useRerouteRfq(rfq.id);

  const [selected, setSelected] = useState<string[]>(
    rfq.requestedCategoryIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const busy = reroute.isPending;

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function submit() {
    setError(null);
    try {
      await reroute.mutateAsync({ requestedCategoryIds: selected });
    } catch {
      // Most likely the picked categories map to no active department inbox.
      setError(t('error'));
    }
  }

  return (
    <DetailSection
      title={t('title')}
      description={t('subtitle')}
      className="border-rose-300"
    >
      <div className="space-y-4">
        <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3 text-sm">
          <p className="font-medium text-rose-900">{t('declinedHeading')}</p>
          {rfq.declineReason && (
            <p className="mt-1 text-rose-800">{rfq.declineReason}</p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            {t('chooseDepts')}
          </legend>
          {catsLoading ? (
            <div className="h-10 animate-pulse rounded bg-muted" />
          ) : (
            cats.map((c) => {
              const label = locale === 'ar' ? (c.nameAr ?? c.name) : c.name;
              const on = selected.includes(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 text-sm',
                    on
                      ? 'border-abak-blue bg-abak-blue/5 font-medium'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(c.id)}
                    disabled={busy}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              );
            })
          )}
        </fieldset>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy || selected.length === 0}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-abak-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t('resubmit')}
        </button>
      </div>
    </DetailSection>
  );
}
