'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectsList } from '@/lib/hooks/use-projects';
import type { ProjectStatus } from '@/lib/types/project';
import { Link } from '@/i18n/navigation';

const STATUS_BADGE: Record<ProjectStatus, string> = {
  PLANNING: 'bg-slate-200 text-slate-800',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  ON_HOLD: 'bg-amber-100 text-amber-800',
  AT_RISK: 'bg-rose-100 text-rose-800',
  CLOSING: 'bg-indigo-100 text-indigo-800',
  CLOSED: 'bg-zinc-200 text-zinc-700',
  CANCELLED: 'bg-zinc-400 text-white',
};

export default function ProjectsListPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useProjectsList({
    status: status || undefined,
    search: search || undefined,
    pageSize: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('project.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('project.subtitle')}</p>
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
            onChange={(e) => setStatus(e.target.value as ProjectStatus | '')}
            className="input-base max-w-xs"
          >
            <option value="">{t('common.filter')}</option>
            {(
              [
                'PLANNING',
                'ACTIVE',
                'ON_HOLD',
                'AT_RISK',
                'CLOSING',
                'CLOSED',
                'CANCELLED',
              ] as ProjectStatus[]
            ).map((s) => (
              <option key={s} value={s}>
                {t(`project.status.${s}`)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('project.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-sm text-muted-foreground">
              {t('common.loading')}
            </div>
          )}
          {!isLoading && data?.data.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {t('project.empty')}
            </div>
          )}
          {data && data.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-start">{t('project.number')}</th>
                    <th className="py-2 text-start">
                      {t('project.projectTitle')}
                    </th>
                    <th className="py-2 text-start">{t('project.client')}</th>
                    <th className="py-2 text-start">{t('project.pm')}</th>
                    <th className="py-2 text-start">
                      {t('common.statusLabel')}
                    </th>
                    <th className="py-2 text-end">
                      {t('project.contractValue')}
                    </th>
                    <th className="py-2 text-end">
                      {t('project.actualProgress')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((project) => (
                    <tr key={project.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-mono text-abak-blue hover:underline"
                        >
                          {project.projectNumber}
                        </Link>
                      </td>
                      <td className="py-2">{project.title}</td>
                      <td className="py-2">
                        {project.client.companyName ??
                          project.client.contactName}
                      </td>
                      <td className="py-2">
                        {`${project.pm.firstName ?? ''} ${project.pm.lastName ?? ''}`.trim() ||
                          '—'}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[project.status]}`}
                        >
                          {t(`project.status.${project.status}`)}
                        </span>
                      </td>
                      <td className="py-2 text-end font-mono">
                        {project.contractValue.toLocaleString()}{' '}
                        {t('units.sar')}
                      </td>
                      <td className="py-2 text-end">
                        {project.actualProgress.toFixed(1)}%
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
