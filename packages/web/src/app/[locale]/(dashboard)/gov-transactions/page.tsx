'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Landmark, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useGovStats, useGovTransactions } from '@/lib/hooks/use-gov';
import type { GovTxStatus } from '@/lib/types/gov';
import { Link } from '@/i18n/navigation';
import { StatusPill } from '@/components/projects/status-dot';
import { GOV_TONE } from '@/components/projects/gov-status-tone';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

const STATUS_ORDER: GovTxStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

export default function GovTransactionsListPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<GovTxStatus | ''>('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useGovTransactions({
    status: status || undefined,
    search: search || undefined,
    pageSize: 50,
  });
  const { data: stats } = useGovStats();

  const counts = useMemo(() => {
    const map: Partial<Record<GovTxStatus, number>> = {};
    stats?.byStatus.forEach((b) => {
      map[b.status] = b.count;
    });
    return map;
  }, [stats]);

  const openCount =
    (counts.SUBMITTED ?? 0) +
    (counts.UNDER_REVIEW ?? 0) +
    (counts.REVISION_REQUIRED ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">{t('gov.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('gov.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi
          label={t('gov.kpi.open')}
          value={openCount}
          icon={<Landmark className="h-4 w-4" />}
          accent="text-abak-blue"
        />
        <Kpi
          label={t('gov.kpi.awaitingResponse')}
          value={stats?.awaitingResponse ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="text-amber-600"
        />
        <Kpi
          label={t('gov.kpi.weeklyOverdue')}
          value={stats?.unloggedWeekly ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent="text-rose-600"
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="relative min-w-[14rem] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="input-base ps-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={status === ''}
              label={t('project.filterAll')}
              onClick={() => setStatus('')}
            />
            {STATUS_ORDER.map((s) => (
              <FilterChip
                key={s}
                active={status === s}
                label={t(`gov.status.${s}`)}
                onClick={() => setStatus(s)}
                count={counts[s]}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </CardContent>
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('gov.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((tx) => (
            <Link
              key={tx.id}
              href={`/gov-transactions/${tx.id}`}
              className="group block"
            >
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-muted-foreground">
                        {tx.transactionNumber}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-dark-text group-hover:text-abak-blue">
                        {tx.transactionType}
                      </div>
                    </div>
                    <StatusPill
                      tone={GOV_TONE[tx.status]}
                      label={t(`gov.status.${tx.status}`)}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Landmark className="h-3.5 w-3.5" />
                    <span className="truncate">{tx.authorityName}</span>
                    <span>·</span>
                    <span>{t(`gov.category.${tx.authorityCategory}`)}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {tx.project.projectNumber} — {tx.project.title}
                  </div>

                  {tx.assignedPro && (
                    <div className="flex items-center gap-2 text-xs">
                      <UserAvatar
                        firstName={tx.assignedPro.firstName}
                        lastName={tx.assignedPro.lastName}
                        size="xs"
                      />
                      <span className="truncate">
                        {`${tx.assignedPro.firstName ?? ''} ${tx.assignedPro.lastName ?? ''}`.trim() ||
                          tx.assignedPro.email}
                      </span>
                    </div>
                  )}

                  {tx._count && (
                    <div className="flex gap-3 border-t pt-2 text-[11px] text-muted-foreground">
                      <span>
                        {tx._count.visits} {t('gov.tabs.visits')}
                      </span>
                      <span>
                        {tx._count.comments} {t('gov.tabs.comments')}
                      </span>
                      <span>
                        {tx._count.documents} {t('gov.tabs.documents')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className={accent}>{icon}</span>
          {label}
        </div>
        <div className={cn('mt-1 text-2xl font-semibold tabular-nums', accent)}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  label,
  onClick,
  count,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-abak-blue bg-abak-blue text-white'
          : 'border-border text-muted-foreground hover:bg-muted/50',
      )}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px]',
            active ? 'bg-white/20' : 'bg-muted',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
