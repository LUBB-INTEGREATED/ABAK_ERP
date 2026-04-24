'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUsers } from '@/lib/hooks/use-leads';
import {
  type SalesTarget,
  type TargetPeriod,
  type TargetType,
  useTargets,
  useUpsertTarget,
} from '@/lib/hooks/use-pipeline';

const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  REVENUE: 'الإيراد (ريال)',
  QUOTES_SENT: 'عروض أسعار مرسلة',
  CONVERSIONS: 'صفقات مُغلقة',
  VISITS: 'زيارات ميدانية',
};

const TARGET_TYPES: TargetType[] = [
  'REVENUE',
  'QUOTES_SENT',
  'CONVERSIONS',
  'VISITS',
];

function attainmentColor(pct: number) {
  if (pct >= 100) return 'bg-abak-gold';
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function attainmentBadge(pct: number) {
  if (pct >= 100) return 'default';
  if (pct >= 80) return 'secondary';
  return 'destructive';
}

function formatValue(type: TargetType, value: number) {
  if (type === 'REVENUE') {
    return value.toLocaleString('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    });
  }
  return value.toLocaleString('ar-SA');
}

function periodLabel(p: TargetPeriod) {
  return p === 'MONTHLY' ? 'شهري' : 'ربع سنوي';
}

function currentPeriodDates(period: TargetPeriod): {
  periodStart: string;
  periodEnd: string;
} {
  const now = new Date();
  if (period === 'MONTHLY') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0],
    };
  }
  // Quarterly
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return {
    periodStart: start.toISOString().split('T')[0],
    periodEnd: end.toISOString().split('T')[0],
  };
}

interface EditRow {
  ownerId: string;
  type: TargetType;
  period: TargetPeriod;
  targetValue: string;
}

export default function TargetsPage() {
  const t = useTranslations();
  const [period, setPeriod] = useState<TargetPeriod>('MONTHLY');
  const [editRow, setEditRow] = useState<EditRow | null>(null);

  const { data: users } = useUsers();
  const { data: targets, isLoading } = useTargets();
  const { mutateAsync: upsert, isPending } = useUpsertTarget();

  const reps = (users ?? []).filter((u) =>
    ['SALES_REPRESENTATIVE', 'SALES_MANAGER'].includes(u.role),
  );

  // Build a lookup: ownerId → type → target
  const targetMap = new Map<string, Map<TargetType, SalesTarget>>();
  for (const t of targets ?? []) {
    if (t.period !== period) continue;
    if (!targetMap.has(t.ownerId)) targetMap.set(t.ownerId, new Map());
    targetMap.get(t.ownerId)!.set(t.type, t);
  }

  function startEdit(ownerId: string, type: TargetType) {
    const existing = targetMap.get(ownerId)?.get(type);
    setEditRow({
      ownerId,
      type,
      period,
      targetValue: existing ? String(existing.targetValue) : '',
    });
  }

  async function saveEdit() {
    if (!editRow) return;
    const value = Number(editRow.targetValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const dates = currentPeriodDates(editRow.period);
    await upsert({
      ownerId: editRow.ownerId,
      type: editRow.type,
      period: editRow.period,
      periodStart: dates.periodStart,
      periodEnd: dates.periodEnd,
      targetValue: value,
    });
    setEditRow(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nav.targets')}</h1>
          <p className="text-sm text-muted-foreground">
            إدارة أهداف الفريق وتتبع الإنجاز
          </p>
        </div>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as TargetPeriod)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">شهري</SelectItem>
            <SelectItem value="QUARTERLY">ربع سنوي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {TARGET_TYPES.map((type) => {
          const allTargets = (targets ?? []).filter(
            (t) => t.type === type && t.period === period,
          );
          const totalTarget = allTargets.reduce((s, t) => s + t.targetValue, 0);
          const totalAchieved = allTargets.reduce(
            (s, t) => s + t.achievedValue,
            0,
          );
          const pct =
            totalTarget > 0
              ? Math.round((totalAchieved / totalTarget) * 100)
              : 0;
          return (
            <Card key={type} className="p-4">
              <p className="text-xs text-muted-foreground">
                {TARGET_TYPE_LABELS[type]}
              </p>
              <p className="mt-1 text-lg font-bold">
                {formatValue(type, totalAchieved)}
              </p>
              <p className="text-xs text-muted-foreground">
                من {formatValue(type, totalTarget)}
              </p>
              <div className="mt-2 space-y-1">
                <Progress value={pct} className="h-1.5" />
                <p className="text-xs font-medium">{pct}%</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Rep × Target-type grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            أهداف الفريق — {periodLabel(period)}
          </CardTitle>
          <CardDescription className="text-xs">
            انقر على خلية لتعيين أو تعديل الهدف
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">المندوب</TableHead>
                    {TARGET_TYPES.map((type) => (
                      <TableHead
                        key={type}
                        className="whitespace-nowrap text-center text-xs"
                      >
                        {TARGET_TYPE_LABELS[type]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reps.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={TARGET_TYPES.length + 1}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        لا يوجد مندوبون
                      </TableCell>
                    </TableRow>
                  ) : (
                    reps.map((rep) => (
                      <TableRow key={rep.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {rep.firstName} {rep.lastName}
                        </TableCell>
                        {TARGET_TYPES.map((type) => {
                          const tgt = targetMap.get(rep.id)?.get(type);
                          const pct = tgt
                            ? Math.round(
                                (tgt.achievedValue / tgt.targetValue) * 100,
                              )
                            : null;

                          const isEditing =
                            editRow?.ownerId === rep.id &&
                            editRow.type === type;

                          return (
                            <TableCell
                              key={type}
                              className="min-w-[140px] text-center"
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={editRow.targetValue}
                                    onChange={(e) =>
                                      setEditRow((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              targetValue: e.target.value,
                                            }
                                          : null,
                                      )
                                    }
                                    className="h-7 w-24 text-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void saveEdit();
                                      if (e.key === 'Escape') setEditRow(null);
                                    }}
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={isPending}
                                    onClick={() => void saveEdit()}
                                  >
                                    {isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  className="group w-full space-y-1 rounded p-1 text-left hover:bg-muted"
                                  onClick={() => startEdit(rep.id, type)}
                                >
                                  {tgt ? (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs">
                                          {formatValue(type, tgt.achievedValue)}
                                        </span>
                                        <Badge
                                          variant={attainmentBadge(pct ?? 0)}
                                          className="text-[10px]"
                                        >
                                          {pct}%
                                        </Badge>
                                      </div>
                                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                          className={`absolute inset-y-0 start-0 rounded-full transition-all ${attainmentColor(pct ?? 0)}`}
                                          style={{
                                            width: `${Math.min(100, pct ?? 0)}%`,
                                          }}
                                        />
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">
                                        من {formatValue(type, tgt.targetValue)}
                                      </p>
                                    </>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground group-hover:text-foreground">
                                      <Plus className="h-3 w-3" />
                                      تعيين هدف
                                    </span>
                                  )}
                                </button>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
