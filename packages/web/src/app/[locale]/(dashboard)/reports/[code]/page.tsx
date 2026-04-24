'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ChevronRight, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useReport, useReportCatalog } from '@/lib/hooks/use-reports';
import type { ReportColumn } from '@/lib/types/report';
import apiClient from '@/lib/api-client';

function formatCell(value: unknown, type: ReportColumn['type']): string {
  if (value == null) return '-';
  switch (type) {
    case 'currency':
      return typeof value === 'number'
        ? value.toLocaleString('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            maximumFractionDigits: 0,
          })
        : String(value);
    case 'percent':
      return `${value}%`;
    case 'date':
      return String(value);
    default:
      return String(value);
  }
}

export default function ReportPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const t = useTranslations();
  const { data: catalog } = useReportCatalog();
  const reportMeta = catalog
    ?.flatMap((c) => c.reports)
    .find((r) => r.code === code);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [runFilters, setRunFilters] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  const {
    data: result,
    isLoading,
    isFetching,
  } = useReport(
    code,
    runFilters,
    Object.keys(runFilters).length > 0 ||
      reportMeta?.filters.filter((f) => f.required).length === 0,
  );

  function handleRun() {
    setRunFilters({ ...filters });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const resp = await apiClient.get(`/reports/${code}/export`, {
        params: runFilters,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${code}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const columns = result?.meta.columns ?? reportMeta?.columns ?? [];
  const rows = result?.rows ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/reports" className="hover:text-foreground">
          {t('reports.catalog')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">
          {reportMeta?.nameAr ?? code}
        </span>
      </div>

      {/* Filters */}
      {reportMeta && reportMeta.filters.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('reports.filters')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {reportMeta.filters.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs">
                    {f.labelAr}
                    {f.required && (
                      <span className="ms-0.5 text-red-500">*</span>
                    )}
                  </Label>
                  <Input
                    id={f.key}
                    type={f.type === 'date' ? 'date' : 'text'}
                    value={filters[f.key] ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        [f.key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleRun} className="mt-4" disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('reports.runReport')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {result?.summary && Object.keys(result.summary).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(result.summary).map(([key, val]) => (
            <Card key={key} className="p-3">
              <p className="text-xs text-muted-foreground">{key}</p>
              <p className="text-lg font-bold">{String(val)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            {isLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : (
              `${t('reports.results')} (${rows.length})`
            )}
          </CardTitle>
          {rows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="me-2 h-4 w-4" />
              )}
              CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('reports.noData')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="whitespace-nowrap text-xs"
                      >
                        {col.labelAr}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className="whitespace-nowrap text-xs"
                        >
                          {formatCell(row[col.key], col.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
