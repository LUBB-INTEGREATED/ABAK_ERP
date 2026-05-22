'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  BarChart2,
  BookOpen,
  Building2,
  CircleDollarSign,
  Landmark,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useReportCatalog } from '@/lib/hooks/use-reports';
import type { ReportCategory, ReportMeta } from '@/lib/types/report';

const CATEGORY_META: Record<
  ReportCategory,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  sales: { icon: TrendingUp, color: 'text-blue-600' },
  rfq: { icon: BookOpen, color: 'text-purple-600' },
  project: { icon: Building2, color: 'text-green-600' },
  finance: { icon: CircleDollarSign, color: 'text-amber-600' },
  gov: { icon: Landmark, color: 'text-slate-600' },
  sla: { icon: ShieldAlert, color: 'text-red-600' },
  executive: { icon: BarChart2, color: 'text-abak-gold' },
};

function ReportCard({ report }: { report: ReportMeta }) {
  const router = useRouter();
  const locale = useLocale();
  const isAr = locale === 'ar';
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/reports/${report.code}`)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {isAr ? report.nameAr : report.nameEn}
        </CardTitle>
        <CardDescription className="text-xs">
          {isAr ? report.nameEn : report.nameAr}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {report.filters
            .filter((f) => f.required)
            .map((f) => (
              <Badge key={f.key} variant="secondary" className="text-[10px]">
                {isAr ? f.labelAr : f.labelEn}
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const t = useTranslations();
  const tCat = useTranslations('reports.categories');
  const { data: catalog, isLoading } = useReportCatalog();
  const [activeTab, setActiveTab] = useState<string>('sales');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('reports.catalog')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('reports.catalogDescription')}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap gap-1 h-auto">
            {(catalog ?? []).map((cat) => {
              const meta = CATEGORY_META[cat.category as ReportCategory];
              const Icon = meta?.icon;
              return (
                <TabsTrigger
                  key={cat.category}
                  value={cat.category}
                  className="gap-1.5"
                >
                  {Icon && <Icon className={`h-3.5 w-3.5 ${meta.color}`} />}
                  {(() => {
                    try {
                      return tCat(cat.category as never);
                    } catch {
                      return cat.category;
                    }
                  })()}
                  <Badge variant="outline" className="ms-1 text-[10px]">
                    {cat.reports.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(catalog ?? []).map((cat) => (
            <TabsContent key={cat.category} value={cat.category}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cat.reports.map((r) => (
                  <ReportCard key={r.code} report={r} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
