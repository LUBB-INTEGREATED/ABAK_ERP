'use client';

import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Banknote,
  Building2,
  ClipboardList,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useExecutiveKpis } from '@/lib/hooks/use-reports';

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  alert,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-red-300' : undefined}>
      <CardContent className="flex items-start gap-4 pt-5">
        <div
          className={`rounded-full p-2 ${alert ? 'bg-red-100' : 'bg-abak-blue/10'}`}
        >
          <Icon
            className={`h-5 w-5 ${alert ? 'text-red-600' : 'text-abak-blue'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {trend != null && (
            <Badge
              className={`mt-1 text-[10px] ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
              variant="outline"
            >
              {trend >= 0 ? '+' : ''}
              {trend}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'عميل جديد',
  FIRST_CONTACT_MADE: 'التواصل الأول',
  MEETING_SCHEDULED: 'اجتماع مجدول',
  MEETING_DONE: 'اجتماع منتهٍ',
  READY_FOR_RFQ: 'جاهز للطلب',
  RFQ_SUBMITTED: 'طلب تسعير مُرسَل',
  QUOTE_IN_PREPARATION: 'عرض في الإعداد',
  QUOTE_SENT_TO_CLIENT: 'عرض مُرسَل للعميل',
  NEGOTIATION_REVISION: 'تفاوض / مراجعة',
  WON: 'ربح',
  LOST: 'خسارة',
  POSTPONED: 'تأجيل',
};

const PIPELINE_COLORS = [
  '#1e3a5f',
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
  '#bfdbfe',
  '#dbeafe',
];

export default function ExecutiveDashboardPage() {
  const t = useTranslations();
  const { data: kpis, isLoading } = useExecutiveKpis();

  const sarFmt = (n: number) =>
    n.toLocaleString('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    });

  const attainment =
    kpis && kpis.monthlyRevenue.target > 0
      ? Math.round(
          (kpis.monthlyRevenue.actual / kpis.monthlyRevenue.target) * 100,
        )
      : null;

  const openPipeline = kpis?.pipelineFunnel.filter(
    (s) => !['WON', 'LOST', 'POSTPONED'].includes(s.stage),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {t('reports.executiveDashboard')}
          </h1>
          {kpis && (
            <p className="text-xs text-muted-foreground">
              {t('reports.lastUpdated')}:{' '}
              {new Date(kpis.generatedAt).toLocaleTimeString('ar-SA')}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="الإيرادات الشهرية"
            value={sarFmt(kpis?.monthlyRevenue.actual ?? 0)}
            sub={`الهدف: ${sarFmt(kpis?.monthlyRevenue.target ?? 0)}`}
            icon={Banknote}
            trend={attainment ?? undefined}
          />
          <KpiCard
            title="معدل الربح (90 يوماً)"
            value={`${kpis?.winRate ?? 0}%`}
            icon={Trophy}
          />
          <KpiCard
            title="كفاءة التحصيل"
            value={`${kpis?.collectionEfficiency ?? 0}%`}
            sub={`مفتوح: ${sarFmt(kpis?.openInvoicesValue ?? 0)}`}
            icon={TrendingUp}
          />
          <KpiCard
            title="العمولات المتراكمة"
            value={sarFmt(kpis?.commissionAccruing ?? 0)}
            icon={ClipboardList}
          />
          <KpiCard
            title="مشاريع نشطة"
            value={kpis?.activeProjectsCount ?? 0}
            icon={Building2}
          />
          <KpiCard
            title="مشاريع في خطر"
            value={kpis?.atRiskProjectsCount ?? 0}
            icon={AlertTriangle}
            alert={(kpis?.atRiskProjectsCount ?? 0) > 0}
          />
          <KpiCard
            title="معاملات حكومية مفتوحة"
            value={kpis?.openGovTransactionsCount ?? 0}
            icon={ClipboardList}
          />
          <KpiCard
            title="بانتظار ردنا (حكومي)"
            value={kpis?.awaitingResponseGovCount ?? 0}
            icon={AlertTriangle}
            alert={(kpis?.awaitingResponseGovCount ?? 0) > 0}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">خط المبيعات بالمراحل</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={openPipeline?.map((s) => ({
                    ...s,
                    name: STAGE_LABELS[s.stage] ?? s.stage,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === 'count'
                        ? [value, 'العدد']
                        : [sarFmt(Number(value)), 'القيمة']
                    }
                  />
                  <Bar dataKey="count" name="العدد" radius={[4, 4, 0, 0]}>
                    {openPipeline?.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Rep Attainments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              تحقق أهداف فريق المبيعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56" />
            ) : (kpis?.repAttainments ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                لا توجد أهداف محددة لهذا الشهر
              </p>
            ) : (
              <div className="space-y-3">
                {(kpis?.repAttainments ?? []).slice(0, 8).map((rep) => (
                  <div key={rep.ownerId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {rep.ownerId.slice(0, 8)}…
                      </span>
                      <span className="font-medium">{rep.attainment}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          rep.attainment >= 100
                            ? 'bg-green-500'
                            : rep.attainment >= 70
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(rep.attainment, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
