'use client';

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeadsList, useLeadStats } from '@/lib/hooks/use-leads';
import { useClientStats } from '@/lib/hooks/use-clients';
import {
  CHANNEL_LABELS,
  SLA_LABELS,
  STATUS_LABELS,
  type LeadChannel,
  type LeadStatus,
  type SLAStatus,
} from '@/lib/types/lead';
import {
  CLASSIFICATION_LABELS,
  type ClientClassification,
} from '@/lib/types/client';
import { Link } from '@/i18n/navigation';

const CLASSIFICATION_COLORS: Record<ClientClassification, string> = {
  NEW: '#0ea5e9',
  RETURNING: '#236382',
  VIP: '#A78B42',
  DORMANT: '#a1a1aa',
  ARCHIVED: '#ef4444',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: '#0ea5e9',
  ASSIGNED: '#236382',
  CONTACTED: '#6366f1',
  QUALIFIED: '#A78B42',
  UNQUALIFIED: '#a1a1aa',
  CONVERTED: '#10b981',
  LOST: '#ef4444',
  DUPLICATE: '#f59e0b',
};

const SLA_COLORS: Record<SLAStatus, string> = {
  ON_TIME: '#10b981',
  DUE_SOON: '#f59e0b',
  OVERDUE: '#ef4444',
};

export default function DashboardPage() {
  const stats = useLeadStats();
  const clientStats = useClientStats();
  const recent = useLeadsList({ limit: 5, sort: 'createdAt', order: 'desc' });
  const t = useTranslations();

  const classificationData = (clientStats.data?.byClassification ?? []).map(
    (row) => ({
      name:
        CLASSIFICATION_LABELS[row.classification as ClientClassification] ??
        row.classification,
      value: row.count,
      classification: row.classification as ClientClassification,
    }),
  );

  const statusData = (stats.data?.byStatus ?? []).map((row) => ({
    name: STATUS_LABELS[row.status as LeadStatus] ?? row.status,
    value: row.count,
    status: row.status as LeadStatus,
  }));
  const channelData = (stats.data?.byChannel ?? []).map((row) => ({
    name: CHANNEL_LABELS[row.channel as LeadChannel] ?? row.channel,
    count: row.count,
  }));
  const slaData = (stats.data?.bySla ?? []).map((row) => ({
    name: SLA_LABELS[row.slaStatus as SLAStatus] ?? row.slaStatus,
    value: row.count,
    slaStatus: row.slaStatus as SLAStatus,
  }));

  const total = stats.data?.total ?? 0;
  const today = stats.data?.todayCount ?? 0;
  const overdue =
    stats.data?.bySla.find((row) => row.slaStatus === 'OVERDUE')?.count ?? 0;
  const converted =
    stats.data?.byStatus.find((row) => row.status === 'CONVERTED')?.count ?? 0;
  const conversionRate =
    total > 0 ? `${((converted / total) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-abak-blue">
          {t('dashboard.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('dashboard.kpi.totalLeads')} value={total} />
        <KpiCard label={t('dashboard.kpi.newToday')} value={today} highlight />
        <KpiCard label={t('dashboard.kpi.overdueSla')} value={overdue} danger />
        <KpiCard
          label={t('dashboard.kpi.conversionRate')}
          value={conversionRate}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpi.totalClients')}
          value={clientStats.data?.total ?? '—'}
        />
        <KpiCard
          label={t('dashboard.kpi.vipClients')}
          value={
            clientStats.data?.byClassification.find(
              (r) => r.classification === 'VIP',
            )?.count ?? 0
          }
          highlight
        />
        <KpiCard
          label={t('dashboard.kpi.dormantClients')}
          value={
            clientStats.data?.byClassification.find(
              (r) => r.classification === 'DORMANT',
            )?.count ?? 0
          }
        />
        <KpiCard
          label={t('dashboard.kpi.avgLifetimeValue')}
          value={
            clientStats.data
              ? `${Math.round(clientStats.data.averageLifetimeValue).toLocaleString()} ${t('units.sar')}`
              : '—'
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('dashboard.charts.leadsByStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {statusData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {statusData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('dashboard.charts.leadsByChannel')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {channelData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData}>
                  <XAxis
                    dataKey="name"
                    fontSize={11}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#236382" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('dashboard.charts.clientsByClassification')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {classificationData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classificationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                  >
                    {classificationData.map((entry) => (
                      <Cell
                        key={entry.classification}
                        fill={CLASSIFICATION_COLORS[entry.classification]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('dashboard.charts.slaCompliance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            {slaData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slaData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                  >
                    {slaData.map((entry) => (
                      <Cell
                        key={entry.slaStatus}
                        fill={SLA_COLORS[entry.slaStatus]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t('dashboard.charts.recentLeads')}
            </CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/leads">{t('common.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.isLoading && (
              <div className="text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            )}
            {!recent.isLoading && recent.data?.data.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {t('dashboard.noLeads')}
              </div>
            )}
            <ul className="space-y-2">
              {recent.data?.data.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-mono text-abak-blue hover:underline"
                    >
                      {lead.leadNumber}
                    </Link>
                    <span className="ml-3 font-medium">{lead.contactName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {CHANNEL_LABELS[lead.channel]}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[lead.status]}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={
            danger
              ? 'mt-1 text-2xl font-semibold text-rose-600'
              : highlight
                ? 'mt-1 text-2xl font-semibold text-abak-gold'
                : 'mt-1 text-2xl font-semibold text-abak-blue'
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  const t = useTranslations();
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {t('common.noDataYet')}
    </div>
  );
}
