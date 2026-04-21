'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuditLogs } from '@/lib/hooks/use-audit';

export default function AuditPage() {
  const t = useTranslations();
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const { data, isLoading } = useAuditLogs({
    entity: entity || undefined,
    action: action || undefined,
    pageSize: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('audit.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder={t('audit.entity')}
              className="input-base ps-9 w-60"
            />
          </div>
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t('audit.action')}
            className="input-base w-60"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {t('audit.eventsHeading')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {t('common.empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-start">{t('audit.when')}</th>
                    <th className="py-2 text-start">{t('audit.action')}</th>
                    <th className="py-2 text-start">{t('audit.entity')}</th>
                    <th className="py-2 text-start">{t('audit.entityId')}</th>
                    <th className="py-2 text-start">{t('audit.actor')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 text-xs">
                        {log.createdAt.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2 font-mono text-xs">{log.action}</td>
                      <td className="py-2 text-xs">{log.entity}</td>
                      <td className="py-2 font-mono text-[11px] text-muted-foreground">
                        {log.entityId.slice(0, 14)}…
                      </td>
                      <td className="py-2 font-mono text-[11px] text-muted-foreground">
                        {log.userId ? log.userId.slice(0, 14) + '…' : '—'}
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
