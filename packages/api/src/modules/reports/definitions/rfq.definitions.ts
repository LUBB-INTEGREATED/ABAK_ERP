import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

export const rfqDefinitions: ReportDefinition[] = [
  {
    code: 'RFQ_STATUS_BOARD',
    nameAr: 'لوحة حالة طلبات العروض',
    nameEn: 'RFQ Status Board',
    category: 'rfq',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
    ],
    async run(prisma) {
      const grouped = await prisma.rfq.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      const statusLabels: Record<string, string> = {
        RECEIVED: 'مستلم',
        ASSIGNED: 'مُعيَّن',
        IN_PREPARATION: 'قيد الإعداد',
        PENDING_APPROVAL: 'بانتظار الموافقة',
        APPROVED_READY_FOR_DISPATCH: 'جاهز للإرسال',
        SENT: 'تم الإرسال',
        WON: 'ربح',
        LOST: 'خسارة',
        POSTPONED: 'مؤجل',
        CANCELLED: 'ملغي',
      };

      const rows = grouped.map((g) => ({
        status: statusLabels[g.status] ?? g.status,
        count: g._count.id,
      }));

      const summary = {
        total: rows.reduce((s, r) => s + (r.count as number), 0),
        openCount: grouped
          .filter((g) => !['WON', 'LOST', 'CANCELLED'].includes(g.status))
          .reduce((s, g) => s + g._count.id, 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'QUOTE_APPROVAL_QUEUE',
    nameAr: 'طابور موافقات عروض الأسعار',
    nameEn: 'Quote Approval Queue',
    category: 'rfq',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'quoteNumber',
        labelAr: 'رقم العرض',
        labelEn: 'Quote #',
        type: 'string',
      },
      {
        key: 'approver',
        labelAr: 'المعتمد',
        labelEn: 'Approver',
        type: 'string',
      },
      { key: 'tier', labelAr: 'المستوى', labelEn: 'Tier', type: 'number' },
      {
        key: 'hoursInQueue',
        labelAr: 'ساعات الانتظار',
        labelEn: 'Hours in Queue',
        type: 'number',
      },
    ],
    async run(prisma) {
      const pending = await prisma.quoteApproval.findMany({
        where: { status: 'PENDING' },
        select: {
          tier: true,
          createdAt: true,
          approver: {
            select: { firstName: true, lastName: true, email: true },
          },
          quote: { select: { quoteNumber: true, totalAmount: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const now = Date.now();
      const rows = pending.map((a) => ({
        quoteNumber: a.quote.quoteNumber,
        approver: a.approver
          ? `${a.approver.firstName ?? ''} ${a.approver.lastName ?? ''}`.trim() ||
            a.approver.email
          : '-',
        tier: a.tier,
        hoursInQueue: Math.round((now - a.createdAt.getTime()) / 3_600_000),
        totalAmount: a.quote.totalAmount,
      }));

      const summary = {
        totalPending: rows.length,
        avgHoursInQueue:
          rows.length > 0
            ? Math.round(
                rows.reduce((s, r) => s + (r.hoursInQueue as number), 0) /
                  rows.length,
              )
            : 0,
      };

      return { rows, summary };
    },
  },

  {
    code: 'QUOTE_REVISION_DEPTH',
    nameAr: 'عمق مراجعات عروض الأسعار',
    nameEn: 'Quote Revision Depth',
    category: 'rfq',
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
        key: 'quoteNumber',
        labelAr: 'رقم العرض',
        labelEn: 'Quote #',
        type: 'string',
      },
      {
        key: 'version',
        labelAr: 'الإصدار',
        labelEn: 'Version',
        type: 'number',
      },
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      {
        key: 'totalAmount',
        labelAr: 'القيمة',
        labelEn: 'Amount',
        type: 'currency',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const quotes = await prisma.quote.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          version: { gt: 1 },
          deletedAt: null,
        },
        select: {
          quoteNumber: true,
          version: true,
          status: true,
          totalAmount: true,
          lostReason: true,
        },
        orderBy: { version: 'desc' },
      });

      const rows = quotes.map((q) => ({
        quoteNumber: q.quoteNumber,
        version: q.version,
        status: q.status,
        totalAmount: q.totalAmount,
      }));

      const summary = {
        totalRevised: rows.length,
        avgVersion:
          rows.length > 0
            ? (
                rows.reduce((s, r) => s + (r.version as number), 0) /
                rows.length
              ).toFixed(1)
            : 0,
      };

      return { rows, summary };
    },
  },

  {
    code: 'COMMERCIAL_CONFIRMATION_FUNNEL',
    nameAr: 'مسار التأكيدات التجارية',
    nameEn: 'Commercial Confirmation Funnel',
    category: 'rfq',
    minRoles: [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SALES_MANAGER,
      UserRole.FINANCE_MANAGER,
    ],
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
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const [sentQuotes, confirmations, validated, pos] = await Promise.all([
        prisma.quote.count({
          where: { sentAt: { gte: from, lte: to }, deletedAt: null },
        }),
        prisma.commercialConfirmation.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
        prisma.commercialConfirmation.count({
          where: {
            createdAt: { gte: from, lte: to },
            validationStatus: 'VALIDATED',
          },
        }),
        prisma.purchaseOrder.count({
          where: { createdAt: { gte: from, lte: to } },
        }),
      ]);

      const rows = [
        { stage: 'عروض مُرسَلة', count: sentQuotes },
        { stage: 'تأكيد تجاري مستلم', count: confirmations },
        { stage: 'تم التحقق', count: validated },
        { stage: 'أوامر شراء منشأة', count: pos },
      ];

      return {
        rows,
        summary: { sentQuotes, confirmations, validated, purchaseOrders: pos },
      };
    },
  },

  {
    code: 'QUOTE_EXPIRY_PIPELINE',
    nameAr: 'عروض الأسعار قاربت انتهاء صلاحيتها',
    nameEn: 'Quote Expiry Pipeline',
    category: 'rfq',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'quoteNumber',
        labelAr: 'رقم العرض',
        labelEn: 'Quote #',
        type: 'string',
      },
      { key: 'client', labelAr: 'العميل', labelEn: 'Client', type: 'string' },
      {
        key: 'totalAmount',
        labelAr: 'القيمة',
        labelEn: 'Amount',
        type: 'currency',
      },
      {
        key: 'validUntil',
        labelAr: 'صالح حتى',
        labelEn: 'Valid Until',
        type: 'date',
      },
      {
        key: 'daysLeft',
        labelAr: 'الأيام المتبقية',
        labelEn: 'Days Left',
        type: 'number',
      },
    ],
    async run(prisma) {
      const now = new Date();
      const in30 = new Date(Date.now() + 30 * 86_400_000);

      const quotes = await prisma.quote.findMany({
        where: {
          validUntil: { gte: now, lte: in30 },
          status: { in: ['SENT', 'IN_DISCUSSION', 'IN_NEGOTIATION'] },
          deletedAt: null,
        },
        select: {
          quoteNumber: true,
          totalAmount: true,
          validUntil: true,
          client: { select: { contactName: true, companyName: true } },
        },
        orderBy: { validUntil: 'asc' },
      });

      const rows = quotes.map((q) => ({
        quoteNumber: q.quoteNumber,
        client: q.client.companyName || q.client.contactName,
        totalAmount: q.totalAmount,
        validUntil: q.validUntil?.toISOString().split('T')[0],
        daysLeft: q.validUntil
          ? Math.ceil((q.validUntil.getTime() - now.getTime()) / 86_400_000)
          : null,
      }));

      const summary = {
        totalAtRisk: rows.length,
        totalValue: rows.reduce((s, r) => s + (r.totalAmount as number), 0),
      };

      return { rows, summary };
    },
  },
];
