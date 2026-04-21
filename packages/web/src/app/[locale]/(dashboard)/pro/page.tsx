'use client';

import { useTranslations } from 'next-intl';
import { Landmark, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProDashboard } from '@/lib/hooks/use-gov';
import { Link } from '@/i18n/navigation';
import { StatusPill } from '@/components/projects/status-dot';
import { GOV_TONE } from '@/components/projects/gov-status-tone';

export default function ProDashboardPage() {
  const t = useTranslations();
  const { data, isLoading } = useProDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('proDashboard.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('proDashboard.subtitle')}
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">
          {t('common.loading')}
        </div>
      ) : (
        <>
          {/* Today's visits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('proDashboard.todaysVisits')} ·{' '}
                {data?.visitsToday.length ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!data || data.visitsToday.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('proDashboard.noVisitsToday')}
                </div>
              ) : (
                data.visitsToday.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-md border bg-white p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <Link
                        href={`/gov-transactions/${v.transaction.id}`}
                        className="font-mono text-abak-blue hover:underline"
                      >
                        {v.transaction.transactionNumber}
                      </Link>
                      <span>{v.visitedAt.slice(11, 16)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-medium">
                      <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                      {v.transaction.authorityName}
                    </div>
                    <div className="mt-1 text-xs">{v.purpose}</div>
                    {v.latitude != null && v.longitude != null && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Open transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('proDashboard.openTransactions')} · {data?.open.length ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!data || data.open.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('gov.empty')}
                </div>
              ) : (
                data.open.map((tx) => (
                  <Link
                    key={tx.id}
                    href={`/gov-transactions/${tx.id}`}
                    className="group block"
                  >
                    <div className="rounded-md border bg-white p-3 transition-colors group-hover:border-abak-blue/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-xs text-muted-foreground">
                            {tx.transactionNumber}
                          </span>
                          <span className="font-semibold">
                            {tx.transactionType}
                          </span>
                        </div>
                        <StatusPill
                          tone={GOV_TONE[tx.status]}
                          label={t(`gov.status.${tx.status}`)}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {tx.authorityName} · {tx.project.projectNumber}
                        {tx.expectedResponseAt && (
                          <> · {tx.expectedResponseAt.slice(0, 10)}</>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-xs"
                      >
                        {t('proDashboard.logVisit')}
                      </Button>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
