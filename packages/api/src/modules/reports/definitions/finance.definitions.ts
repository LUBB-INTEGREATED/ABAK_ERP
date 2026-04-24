import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

export const financeDefinitions: ReportDefinition[] = [
  {
    code: 'AR_AGING',
    nameAr: 'تقادم الذمم المدينة',
    nameEn: 'Accounts Receivable Aging',
    category: 'finance',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
    filters: [],
    columns: [
      { key: 'bucket', labelAr: 'الفئة', labelEn: 'Bucket', type: 'string' },
      {
        key: 'count',
        labelAr: 'عدد الفواتير',
        labelEn: 'Invoice Count',
        type: 'number',
      },
      {
        key: 'totalAmount',
        labelAr: 'الإجمالي (ر.س)',
        labelEn: 'Total (SAR)',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const invoices = await prisma.invoice.findMany({
        where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { dueDate: true, totalAmount: true },
      });

      const now = Date.now();
      const buckets: Record<string, { count: number; total: number }> = {
        '0-30 يوم': { count: 0, total: 0 },
        '31-60 يوم': { count: 0, total: 0 },
        '61-90 يوم': { count: 0, total: 0 },
        '+90 يوم': { count: 0, total: 0 },
      };

      for (const inv of invoices) {
        const ageDays = Math.ceil((now - inv.dueDate.getTime()) / 86_400_000);
        let key: string;
        if (ageDays <= 0) key = '0-30 يوم';
        else if (ageDays <= 30) key = '0-30 يوم';
        else if (ageDays <= 60) key = '31-60 يوم';
        else if (ageDays <= 90) key = '61-90 يوم';
        else key = '+90 يوم';
        buckets[key].count++;
        buckets[key].total += inv.totalAmount;
      }

      const rows = Object.entries(buckets).map(([bucket, v]) => ({
        bucket,
        count: v.count,
        totalAmount: v.total,
      }));

      const summary = {
        totalOpenInvoices: invoices.length,
        totalOutstanding: invoices.reduce((s, i) => s + i.totalAmount, 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'COLLECTION_TREND',
    nameAr: 'اتجاه التحصيل',
    nameEn: 'Collection Trend',
    category: 'finance',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
    filters: [],
    columns: [
      { key: 'month', labelAr: 'الشهر', labelEn: 'Month', type: 'string' },
      {
        key: 'collected',
        labelAr: 'المحصَّل (ر.س)',
        labelEn: 'Collected (SAR)',
        type: 'currency',
      },
      {
        key: 'count',
        labelAr: 'عدد المدفوعات',
        labelEn: 'Payments Count',
        type: 'number',
      },
    ],
    async run(prisma) {
      const since = new Date(Date.now() - 365 * 86_400_000);

      const payments = await prisma.payment.findMany({
        where: { validationStatus: 'VALIDATED', validatedAt: { gte: since } },
        select: { validatedAt: true, amount: true },
      });

      const monthMap = new Map<string, { collected: number; count: number }>();
      for (const p of payments) {
        if (!p.validatedAt) continue;
        const key = `${p.validatedAt.getFullYear()}-${String(p.validatedAt.getMonth() + 1).padStart(2, '0')}`;
        const cur = monthMap.get(key) ?? { collected: 0, count: 0 };
        cur.collected += p.amount;
        cur.count++;
        monthMap.set(key, cur);
      }

      const rows = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({
          month,
          collected: v.collected,
          count: v.count,
        }));

      const summary = {
        totalCollected: payments.reduce((s, p) => s + p.amount, 0),
        months: rows.length,
      };

      return { rows, summary };
    },
  },

  {
    code: 'INVOICE_STATUS_MIX',
    nameAr: 'توزيع حالات الفواتير',
    nameEn: 'Invoice Status Mix',
    category: 'finance',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
    filters: [],
    columns: [
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
      {
        key: 'totalAmount',
        labelAr: 'الإجمالي (ر.س)',
        labelEn: 'Total (SAR)',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const grouped = await prisma.invoice.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalAmount: true },
      });

      const statusLabels: Record<string, string> = {
        DRAFT: 'مسودة',
        ISSUED: 'مُصدَرة',
        PARTIALLY_PAID: 'مدفوعة جزئياً',
        PAID: 'مدفوعة',
        OVERDUE: 'متأخرة',
        CANCELLED: 'ملغاة',
        REFUNDED: 'مُستردة',
      };

      const rows = grouped.map((g) => ({
        status: statusLabels[g.status] ?? g.status,
        count: g._count.id,
        totalAmount: g._sum.totalAmount ?? 0,
      }));

      const summary = {
        total: rows.reduce((s, r) => s + (r.count as number), 0),
        totalValue: rows.reduce((s, r) => s + (r.totalAmount as number), 0),
        overdueCount:
          grouped.find((g) => g.status === 'OVERDUE')?._count.id ?? 0,
      };

      return { rows, summary };
    },
  },

  {
    code: 'COMMISSION_PIPELINE',
    nameAr: 'تقرير العمولات',
    nameEn: 'Commission Pipeline',
    category: 'finance',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
    filters: [],
    columns: [
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      {
        key: 'beneficiaryType',
        labelAr: 'نوع المستفيد',
        labelEn: 'Beneficiary Type',
        type: 'string',
      },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
      {
        key: 'totalAmount',
        labelAr: 'الإجمالي (ر.س)',
        labelEn: 'Total (SAR)',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const grouped = await prisma.commission.groupBy({
        by: ['status', 'beneficiaryType'],
        _count: { id: true },
        _sum: { amount: true },
      });

      const statusLabels: Record<string, string> = {
        ACCRUING: 'متراكمة',
        APPROVED: 'معتمدة',
        PAID: 'مدفوعة',
        CANCELLED: 'ملغاة',
      };
      const typeLabels: Record<string, string> = {
        BROKER: 'وسيط',
        SALES_REP: 'مندوب مبيعات',
        REFERRAL_SOURCE: 'جهة إحالة',
      };

      const rows = grouped.map((g) => ({
        status: statusLabels[g.status] ?? g.status,
        beneficiaryType: typeLabels[g.beneficiaryType] ?? g.beneficiaryType,
        count: g._count.id,
        totalAmount: g._sum.amount ?? 0,
      }));

      const summary = {
        totalAccruing: grouped
          .filter((g) => g.status === 'ACCRUING')
          .reduce((s, g) => s + (g._sum.amount ?? 0), 0),
        totalApproved: grouped
          .filter((g) => g.status === 'APPROVED')
          .reduce((s, g) => s + (g._sum.amount ?? 0), 0),
        totalPaid: grouped
          .filter((g) => g.status === 'PAID')
          .reduce((s, g) => s + (g._sum.amount ?? 0), 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'REVENUE_RECOGNITION',
    nameAr: 'الإيرادات المُثبَّتة مقابل المفوترة مقابل المحصَّلة',
    nameEn: 'Revenue Recognition',
    category: 'finance',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
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
      { key: 'stage', labelAr: 'المرحلة', labelEn: 'Stage', type: 'string' },
      {
        key: 'amount',
        labelAr: 'المبلغ (ر.س)',
        labelEn: 'Amount (SAR)',
        type: 'currency',
      },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const [wonQuotes, invoices, payments] = await Promise.all([
        prisma.quote.aggregate({
          where: {
            status: 'WON',
            wonAt: { gte: from, lte: to },
            deletedAt: null,
          },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        prisma.invoice.aggregate({
          where: { issueDate: { gte: from, lte: to } },
          _sum: { totalAmount: true },
          _count: { id: true },
        }),
        prisma.payment.aggregate({
          where: {
            validationStatus: 'VALIDATED',
            validatedAt: { gte: from, lte: to },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
      ]);

      const rows = [
        {
          stage: 'عروض رابحة',
          amount: wonQuotes._sum.totalAmount ?? 0,
          count: wonQuotes._count.id,
        },
        {
          stage: 'مفوترة',
          amount: invoices._sum.totalAmount ?? 0,
          count: invoices._count.id,
        },
        {
          stage: 'محصَّلة',
          amount: payments._sum.amount ?? 0,
          count: payments._count.id,
        },
      ];

      const summary = {
        collectionEfficiency: invoices._sum.totalAmount
          ? Math.round(
              ((payments._sum.amount ?? 0) / invoices._sum.totalAmount) * 100,
            )
          : 0,
      };

      return { rows, summary };
    },
  },

  {
    code: 'FINANCIAL_RISK_REPORT',
    nameAr: 'تقرير الخطر المالي',
    nameEn: 'Financial Risk Report',
    category: 'finance',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER],
    filters: [],
    columns: [
      {
        key: 'projectNumber',
        labelAr: 'رقم المشروع',
        labelEn: 'Project #',
        type: 'string',
      },
      { key: 'title', labelAr: 'العنوان', labelEn: 'Title', type: 'string' },
      {
        key: 'contractValue',
        labelAr: 'قيمة العقد',
        labelEn: 'Contract Value',
        type: 'currency',
      },
      {
        key: 'collected',
        labelAr: 'المحصَّل',
        labelEn: 'Collected',
        type: 'currency',
      },
      { key: 'gap', labelAr: 'الفجوة', labelEn: 'Gap', type: 'currency' },
      {
        key: 'riskReason',
        labelAr: 'سبب الخطر',
        labelEn: 'Risk Reason',
        type: 'string',
      },
    ],
    async run(prisma) {
      const projects = await prisma.project.findMany({
        where: {
          financialRiskFlagged: true,
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
        select: {
          projectNumber: true,
          title: true,
          contractValue: true,
          financialRiskReason: true,
          invoices: {
            select: {
              payments: {
                where: { validationStatus: 'VALIDATED' },
                select: { amount: true },
              },
            },
          },
        },
      });

      const rows = projects.map((p) => {
        const collected = p.invoices
          .flatMap((i) => i.payments)
          .reduce((s, pay) => s + pay.amount, 0);
        return {
          projectNumber: p.projectNumber,
          title: p.title,
          contractValue: p.contractValue,
          collected,
          gap: p.contractValue - collected,
          riskReason: p.financialRiskReason ?? '-',
        };
      });

      const summary = {
        totalAtRisk: rows.length,
        totalGap: rows.reduce((s, r) => s + (r.gap as number), 0),
      };

      return { rows, summary };
    },
  },
];
