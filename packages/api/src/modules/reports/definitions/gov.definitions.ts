import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

export const govDefinitions: ReportDefinition[] = [
  {
    code: 'GOV_TRANSACTIONS_STATUS',
    nameAr: 'حالة المعاملات الحكومية',
    nameEn: 'Government Transactions Status',
    category: 'gov',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      {
        key: 'authorityCategory',
        labelAr: 'فئة الجهة',
        labelEn: 'Authority Category',
        type: 'string',
      },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
    ],
    async run(prisma) {
      const grouped = await prisma.govTransaction.groupBy({
        by: ['status', 'authorityCategory'],
        _count: { id: true },
      });

      const statusLabels: Record<string, string> = {
        DRAFT: 'مسودة',
        SUBMITTED: 'مقدَّمة',
        UNDER_REVIEW: 'تحت المراجعة',
        REVISION_REQUIRED: 'تتطلب مراجعة',
        APPROVED: 'معتمدة',
        REJECTED: 'مرفوضة',
        CANCELLED: 'ملغاة',
      };
      const catLabels: Record<string, string> = {
        MUNICIPALITY: 'بلدية',
        MINISTRY: 'وزارة',
        UTILITY: 'مرافق',
        PLATFORM_ETIMAD: 'إتمام',
        PLATFORM_FURSA: 'فرصة',
        OTHER: 'أخرى',
      };

      const rows = grouped.map((g) => ({
        status: statusLabels[g.status] ?? g.status,
        authorityCategory:
          catLabels[g.authorityCategory] ?? g.authorityCategory,
        count: g._count.id,
      }));

      const summary = {
        totalOpen: grouped
          .filter(
            (g) => !['APPROVED', 'REJECTED', 'CANCELLED'].includes(g.status),
          )
          .reduce((s, g) => s + g._count.id, 0),
        totalApproved: grouped
          .filter((g) => g.status === 'APPROVED')
          .reduce((s, g) => s + g._count.id, 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'GOV_APPROVAL_CYCLE_TIME',
    nameAr: 'وقت دورة الموافقة الحكومية',
    nameEn: 'Government Approval Cycle Time',
    category: 'gov',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [
      {
        key: 'from',
        type: 'date',
        labelAr: 'من تاريخ',
        labelEn: 'From',
        required: true,
      },
      {
        key: 'to',
        type: 'date',
        labelAr: 'إلى تاريخ',
        labelEn: 'To',
        required: true,
      },
    ],
    columns: [
      {
        key: 'authorityName',
        labelAr: 'اسم الجهة',
        labelEn: 'Authority',
        type: 'string',
      },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
      {
        key: 'avgDays',
        labelAr: 'متوسط الأيام',
        labelEn: 'Avg Days',
        type: 'number',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const txs = await prisma.govTransaction.findMany({
        where: {
          status: 'APPROVED',
          resolvedAt: { gte: from, lte: to },
          submittedAt: { not: null },
        },
        select: { authorityName: true, submittedAt: true, resolvedAt: true },
      });

      const map = new Map<string, { totalDays: number; count: number }>();
      for (const tx of txs) {
        if (!tx.submittedAt || !tx.resolvedAt) continue;
        const days = Math.ceil(
          (tx.resolvedAt.getTime() - tx.submittedAt.getTime()) / 86_400_000,
        );
        const cur = map.get(tx.authorityName) ?? { totalDays: 0, count: 0 };
        cur.totalDays += days;
        cur.count++;
        map.set(tx.authorityName, cur);
      }

      const rows = Array.from(map.entries())
        .map(([authorityName, v]) => ({
          authorityName,
          count: v.count,
          avgDays: Math.round(v.totalDays / v.count),
        }))
        .sort((a, b) => b.avgDays - a.avgDays);

      const allDays = rows.reduce((s, r) => s + r.avgDays * r.count, 0);
      const allCount = rows.reduce((s, r) => s + r.count, 0);

      const summary = {
        overallAvgDays: allCount > 0 ? Math.round(allDays / allCount) : 0,
        authorities: rows.length,
      };

      return { rows, summary };
    },
  },

  {
    code: 'PRO_VISIT_ACTIVITY',
    nameAr: 'نشاط زيارات المراسل',
    nameEn: 'PRO Visit Activity',
    category: 'gov',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [
      {
        key: 'from',
        type: 'date',
        labelAr: 'من تاريخ',
        labelEn: 'From',
        required: true,
      },
      {
        key: 'to',
        type: 'date',
        labelAr: 'إلى تاريخ',
        labelEn: 'To',
        required: true,
      },
    ],
    columns: [
      { key: 'proName', labelAr: 'المراسل', labelEn: 'PRO', type: 'string' },
      {
        key: 'visitsCount',
        labelAr: 'عدد الزيارات',
        labelEn: 'Visits',
        type: 'number',
      },
      {
        key: 'unloggedCount',
        labelAr: 'غير مُسجَّلة',
        labelEn: 'Unlogged',
        type: 'number',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(Date.now() - 30 * 86_400_000);
      const to = filters.to ? new Date(filters.to) : new Date();

      const visits = await prisma.govVisit.findMany({
        where: { visitDate: { gte: from, lte: to } },
        select: {
          visitLoggedAt: true,
          govTransaction: {
            select: {
              assignedPro: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      const map = new Map<
        string,
        { name: string; total: number; unlogged: number }
      >();
      for (const v of visits) {
        const pro = v.govTransaction.assignedPro;
        if (!pro) continue;
        const name =
          `${pro.firstName ?? ''} ${pro.lastName ?? ''}`.trim() || pro.email;
        const cur = map.get(pro.id) ?? { name, total: 0, unlogged: 0 };
        cur.total++;
        if (!v.visitLoggedAt) cur.unlogged++;
        map.set(pro.id, cur);
      }

      const rows = Array.from(map.values()).map((m) => ({
        proName: m.name,
        visitsCount: m.total,
        unloggedCount: m.unlogged,
      }));

      const summary = {
        totalVisits: rows.reduce((s, r) => s + (r.visitsCount as number), 0),
        totalUnlogged: rows.reduce(
          (s, r) => s + (r.unloggedCount as number),
          0,
        ),
      };

      return { rows, summary };
    },
  },

  {
    code: 'PERMIT_AUTHORITY_HEATMAP',
    nameAr: 'الخريطة الحرارية لجهات التصاريح',
    nameEn: 'Permit Authority Heatmap',
    category: 'gov',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'authorityName',
        labelAr: 'اسم الجهة',
        labelEn: 'Authority',
        type: 'string',
      },
      { key: 'volume', labelAr: 'الحجم', labelEn: 'Volume', type: 'number' },
      {
        key: 'avgApprovalDays',
        labelAr: 'متوسط أيام الموافقة',
        labelEn: 'Avg Approval Days',
        type: 'number',
      },
    ],
    async run(prisma) {
      const txs = await prisma.govTransaction.findMany({
        select: {
          authorityName: true,
          submittedAt: true,
          resolvedAt: true,
          status: true,
        },
      });

      const map = new Map<
        string,
        { volume: number; totalDays: number; approvedCount: number }
      >();
      for (const tx of txs) {
        const cur = map.get(tx.authorityName) ?? {
          volume: 0,
          totalDays: 0,
          approvedCount: 0,
        };
        cur.volume++;
        if (tx.status === 'APPROVED' && tx.submittedAt && tx.resolvedAt) {
          cur.totalDays += Math.ceil(
            (tx.resolvedAt.getTime() - tx.submittedAt.getTime()) / 86_400_000,
          );
          cur.approvedCount++;
        }
        map.set(tx.authorityName, cur);
      }

      const rows = Array.from(map.entries())
        .map(([authorityName, v]) => ({
          authorityName,
          volume: v.volume,
          avgApprovalDays:
            v.approvedCount > 0
              ? Math.round(v.totalDays / v.approvedCount)
              : null,
        }))
        .sort((a, b) => b.volume - a.volume);

      const summary = {
        totalAuthorities: rows.length,
        totalVolume: rows.reduce((s, r) => s + r.volume, 0),
      };

      return { rows, summary };
    },
  },
];
