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
import { type LeadStatus, type SLAStatus } from '@/lib/types/lead';
import { type ClientClassification } from '@/lib/types/client';
import { Link } from '@/i18n/navigation';
import { useTranslations as useT } from 'next-intl';

// Brand-anchored categorical palette. Navy ramp for in-progress / neutral states,
// semantic tones reserved for terminal states (success green, destructive red, muted gray).
// This replaces the 10-color rainbow flagged in the UI audit (Tier 3 #12).
const BRAND_NAVY = '#0B1F33';
const BRAND_NAVY_400 = '#3D6590';
const BRAND_NAVY_300 = '#6F8DAE';
const BRAND_COPPER = '#B45C2C';
const SUCCESS = '#15803D'; // emerald-700 (matches --success token)
const DESTRUCTIVE = '#C8302C';
const WARNING = '#D97706';
const MUTED = '#94928D';

const CLASSIFICATION_COLORS: Record<ClientClassification, string> = {
  NEW: BRAND_NAVY_300,
  RETURNING: BRAND_NAVY,
  VIP: BRAND_COPPER,
  DORMANT: MUTED,
  ARCHIVED: DESTRUCTIVE,
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  INCOMING: BRAND_NAVY_300,
  ASSIGNED: BRAND_NAVY_400,
  IN_PROGRESS: BRAND_NAVY,
  QUALIFIED: SUCCESS,
  DISQUALIFIED: MUTED,
  TENDER_PENDING: BRAND_NAVY_400,
  TENDER_ACTIVE: BRAND_NAVY,
  TENDER_SUBMITTED: BRAND_COPPER,
  TENDER_WON: SUCCESS,
  TENDER_LOST: DESTRUCTIVE,
};

const SLA_COLORS: Record<SLAStatus, string> = {
  ON_TIME: SUCCESS,
  DUE_SOON: WARNING,
  OVERDUE: DESTRUCTIVE,
};

export default function DashboardPage() {
  const stats = useLeadStats();
  const clientStats = useClientStats();
  const recent = useLeadsList({ limit: 5, sort: 'createdAt', order: 'desc' });
  const t = useTranslations();
  const tLeadStatus = useT('lead.status');
  const tLeadChannel = useT('lead.channel');
  const tSla = useT('lead.sla');
  const tClassification = useT('client.classification');

  const safeT = (translate: ReturnType<typeof useT>, key: string) => {
    try {
      return translate(key as never);
    } catch {
      return key;
    }
  };

  const classificationData = (clientStats.data?.byClassification ?? []).map(
    (row) => ({
      name: safeT(tClassification, row.classification),
      value: row.count,
      classification: row.classification as ClientClassification,
    }),
  );

  const statusData = (stats.data?.byStatus ?? []).map((row) => ({
    name: safeT(tLeadStatus, row.status),
    value: row.count,
    status: row.status as LeadStatus,
  }));
  const channelData = (stats.data?.byChannel ?? []).map((row) => ({
    name: safeT(tLeadChannel, row.channel),
    count: row.count,
  }));
  const slaData = (stats.data?.bySla ?? []).map((row) => ({
    name: safeT(tSla, row.slaStatus),
    value: row.count,
    slaStatus: row.slaStatus as SLAStatus,
  }));

  const total = stats.data?.total ?? 0;
  const today = stats.data?.todayCount ?? 0;
  const overdue =
    stats.data?.bySla.find((row) => row.slaStatus === 'OVERDUE')?.count ?? 0;
  const qualified =
    (stats.data?.byStatus.find((row) => row.status === 'QUALIFIED')?.count ??
      0) +
    (stats.data?.byStatus.find((row) => row.status === 'TENDER_WON')?.count ??
      0);
  const conversionRate =
    total > 0 ? `${((qualified / total) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-display-md text-primary">
          {t('dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Hero KPIs — volume + outcome. The two numbers that matter most. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <HeroKpiCard
          label={t('dashboard.kpi.totalLeads')}
          value={total}
          caption={
            today > 0
              ? `+${today} ${t('dashboard.kpi.newTodaySuffix')}`
              : undefined
          }
        />
        <HeroKpiCard
          label={t('dashboard.kpi.conversionRate')}
          value={conversionRate}
          caption={`${qualified} / ${total} ${t('dashboard.kpi.qualifiedSuffix')}`}
        />
      </div>

      {/* Secondary KPIs — six small tiles, evenly weighted */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label={t('dashboard.kpi.newToday')} value={today} highlight />
        <KpiCard label={t('dashboard.kpi.overdueSla')} value={overdue} danger />
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
                    fontSize={13}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis fontSize={13} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill={BRAND_NAVY}
                    radius={[4, 4, 0, 0]}
                  />
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
                    <span className="ms-3 font-medium">{lead.contactName}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      · {safeT(tLeadChannel, lead.channel)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {safeT(tLeadStatus, lead.status)}
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
      <CardContent className="py-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={
            danger
              ? 'num mt-1 text-xl font-semibold text-destructive'
              : highlight
                ? 'num mt-1 text-xl font-semibold text-warning'
                : 'num mt-1 text-xl font-semibold text-primary'
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function HeroKpiCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: number | string;
  caption?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative py-6">
        {/* Subtle copper hairline anchors the hero tier */}
        <span
          aria-hidden
          className="absolute inset-y-6 start-0 w-[3px] rounded-full bg-secondary/60"
        />
        <div className="ps-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="num font-display mt-2 text-display-md text-primary">
            {value}
          </div>
          {caption && (
            <div className="num mt-1 text-xs text-muted-foreground">
              {caption}
            </div>
          )}
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
