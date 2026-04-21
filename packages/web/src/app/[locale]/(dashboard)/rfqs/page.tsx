'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRfqsList } from '@/lib/hooks/use-rfqs';
import type { RfqStatus } from '@/lib/types/rfq';
import { Link } from '@/i18n/navigation';

const STATUS_BADGE: Record<RfqStatus, string> = {
  RECEIVED: 'bg-slate-200 text-slate-800',
  ASSIGNED: 'bg-sky-100 text-sky-800',
  IN_PREPARATION: 'bg-indigo-100 text-indigo-800',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED_READY_FOR_DISPATCH: 'bg-emerald-100 text-emerald-800',
  SENT: 'bg-emerald-100 text-emerald-800',
  WON: 'bg-emerald-600 text-white',
  LOST: 'bg-rose-600 text-white',
  POSTPONED: 'bg-zinc-300 text-zinc-800',
  CANCELLED: 'bg-zinc-400 text-white',
};

export default function RfqsListPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<RfqStatus | ''>('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useRfqsList({
    status: status || undefined,
    search: search || undefined,
    pageSize: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-abak-blue">
            {t('rfq.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('rfq.subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="input-base max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RfqStatus | '')}
            className="input-base max-w-xs"
          >
            <option value="">{t('common.filter')}</option>
            {(
              [
                'RECEIVED',
                'ASSIGNED',
                'IN_PREPARATION',
                'PENDING_APPROVAL',
                'APPROVED_READY_FOR_DISPATCH',
                'SENT',
                'WON',
                'LOST',
                'POSTPONED',
                'CANCELLED',
              ] as RfqStatus[]
            ).map((s) => (
              <option key={s} value={s}>
                {t(`rfq.status.${s}`)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rfq.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          )}
          {!isLoading && data?.data.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {t('rfq.empty')}
            </div>
          )}
          {data && data.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-xs text-muted-foreground">
                    <th className="py-2 text-start">{t('rfq.number')}</th>
                    <th className="py-2 text-start">{t('rfq.client')}</th>
                    <th className="py-2 text-start">{t('rfq.serviceType')}</th>
                    <th className="py-2 text-start">{t('rfq.coordinator')}</th>
                    <th className="py-2 text-start">
                      {t('common.statusLabel')}
                    </th>
                    <th className="py-2 text-start">{t('rfq.priority')}</th>
                    <th className="py-2 text-start">{t('rfq.source')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((rfq) => (
                    <tr key={rfq.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/rfqs/${rfq.id}`}
                          className="font-mono text-abak-blue hover:underline"
                        >
                          {rfq.rfqNumber}
                        </Link>
                      </td>
                      <td className="py-2">
                        {rfq.client?.companyName ?? rfq.client?.contactName}
                      </td>
                      <td className="py-2">{rfq.serviceType}</td>
                      <td className="py-2">
                        {rfq.coordinator
                          ? `${rfq.coordinator.firstName ?? ''} ${
                              rfq.coordinator.lastName ?? ''
                            }`.trim()
                          : '—'}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[rfq.status]}`}
                        >
                          {t(`rfq.status.${rfq.status}`)}
                        </span>
                      </td>
                      <td className="py-2">
                        {t(`rfq.priorityLabel.${rfq.priority}`)}
                      </td>
                      <td className="py-2">
                        {t(`rfq.sourceLabel.${rfq.requestedByChannel}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
