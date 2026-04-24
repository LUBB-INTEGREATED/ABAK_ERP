import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

export const slaDefinitions: ReportDefinition[] = [
  {
    code: 'SLA_BREACH_SUMMARY',
    nameAr: 'ملخص خرق مستويات الخدمة',
    nameEn: 'SLA Breach Summary',
    category: 'sla',
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
      { key: 'entity', labelAr: 'الكيان', labelEn: 'Entity', type: 'string' },
      {
        key: 'totalCount',
        labelAr: 'الإجمالي',
        labelEn: 'Total',
        type: 'number',
      },
      {
        key: 'breachedCount',
        labelAr: 'خرق المستوى',
        labelEn: 'Breached',
        type: 'number',
      },
      {
        key: 'breachRate',
        labelAr: 'معدل الخرق %',
        labelEn: 'Breach Rate %',
        type: 'percent',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const [totalLeads, breachedLeads] = await Promise.all([
        prisma.lead.count({ where: { createdAt: { gte: from, lte: to } } }),
        prisma.lead.count({
          where: { createdAt: { gte: from, lte: to }, slaStatus: 'OVERDUE' },
        }),
      ]);

      const rows = [
        {
          entity: 'عملاء محتملون',
          totalCount: totalLeads,
          breachedCount: breachedLeads,
          breachRate:
            totalLeads > 0 ? Math.round((breachedLeads / totalLeads) * 100) : 0,
        },
      ];

      const summary = { totalBreaches: breachedLeads };

      return { rows, summary };
    },
  },

  {
    code: 'ESCALATION_LADDER_REPORT',
    nameAr: 'تقرير سلّم التصعيد',
    nameEn: 'Escalation Ladder Report',
    category: 'sla',
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
      { key: 'level', labelAr: 'المستوى', labelEn: 'Level', type: 'string' },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
      {
        key: 'resolvedCount',
        labelAr: 'محلول',
        labelEn: 'Resolved',
        type: 'number',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const grouped = await prisma.escalationInstance.groupBy({
        by: ['currentLevel'],
        where: { triggeredAt: { gte: from, lte: to } },
        _count: { id: true },
      });

      const resolved = await prisma.escalationInstance.groupBy({
        by: ['currentLevel'],
        where: {
          triggeredAt: { gte: from, lte: to },
          resolvedAt: { not: null },
        },
        _count: { id: true },
      });

      const resolvedMap = new Map(
        resolved.map((r) => [r.currentLevel, r._count.id]),
      );
      const levelLabels = ['المستوى الأول', 'المستوى الثاني', 'المستوى الثالث'];

      const rows = grouped.map((g) => ({
        level: levelLabels[g.currentLevel - 1] ?? `المستوى ${g.currentLevel}`,
        count: g._count.id,
        resolvedCount: resolvedMap.get(g.currentLevel) ?? 0,
      }));

      const summary = {
        totalEscalations: rows.reduce((s, r) => s + (r.count as number), 0),
        totalResolved: rows.reduce(
          (s, r) => s + (r.resolvedCount as number),
          0,
        ),
      };

      return { rows, summary };
    },
  },

  {
    code: 'RESPONSE_TIME_DISTRIBUTION',
    nameAr: 'توزيع وقت الاستجابة للعملاء',
    nameEn: 'Response Time Distribution',
    category: 'sla',
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
      { key: 'bucket', labelAr: 'الفئة', labelEn: 'Bucket', type: 'string' },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
      { key: 'percentage', labelAr: 'النسبة %', labelEn: '%', type: 'percent' },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const leads = await prisma.lead.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          firstResponseAt: { not: null },
        },
        select: { createdAt: true, firstResponseAt: true },
      });

      const buckets: Record<string, number> = {
        '< 1 ساعة': 0,
        '1-4 ساعات': 0,
        '4-24 ساعة': 0,
        '1-3 أيام': 0,
        '> 3 أيام': 0,
      };

      for (const l of leads) {
        if (!l.firstResponseAt) continue;
        const hours =
          (l.firstResponseAt.getTime() - l.createdAt.getTime()) / 3_600_000;
        if (hours < 1) buckets['< 1 ساعة']++;
        else if (hours < 4) buckets['1-4 ساعات']++;
        else if (hours < 24) buckets['4-24 ساعة']++;
        else if (hours < 72) buckets['1-3 أيام']++;
        else buckets['> 3 أيام']++;
      }

      const total = leads.length;
      const rows = Object.entries(buckets).map(([bucket, count]) => ({
        bucket,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));

      const allHours = leads
        .map((l) =>
          l.firstResponseAt
            ? (l.firstResponseAt.getTime() - l.createdAt.getTime()) / 3_600_000
            : 0,
        )
        .sort((a, b) => a - b);

      const p50 = allHours[Math.floor(allHours.length * 0.5)] ?? 0;
      const p90 = allHours[Math.floor(allHours.length * 0.9)] ?? 0;
      const p95 = allHours[Math.floor(allHours.length * 0.95)] ?? 0;

      const summary = {
        totalLeads: total,
        p50Hours: Math.round(p50),
        p90Hours: Math.round(p90),
        p95Hours: Math.round(p95),
      };

      return { rows, summary };
    },
  },

  {
    code: 'OVERDUE_FOLLOWUP_REPORT',
    nameAr: 'تقرير المتابعات المتأخرة',
    nameEn: 'Overdue Follow-up Report',
    category: 'sla',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'repName',
        labelAr: 'المسؤول',
        labelEn: 'Assignee',
        type: 'string',
      },
      {
        key: 'clientName',
        labelAr: 'العميل',
        labelEn: 'Client',
        type: 'string',
      },
      { key: 'title', labelAr: 'العنوان', labelEn: 'Title', type: 'string' },
      {
        key: 'dueAt',
        labelAr: 'تاريخ الاستحقاق',
        labelEn: 'Due Date',
        type: 'date',
      },
      {
        key: 'daysOverdue',
        labelAr: 'أيام التأخر',
        labelEn: 'Days Overdue',
        type: 'number',
      },
    ],
    async run(prisma) {
      const now = new Date();

      const followUps = await prisma.followUp.findMany({
        where: {
          dueAt: { lt: now },
          completedAt: null,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          title: true,
          dueAt: true,
          assignedTo: {
            select: { firstName: true, lastName: true, email: true },
          },
          client: { select: { contactName: true, companyName: true } },
        },
        orderBy: { dueAt: 'asc' },
        take: 100,
      });

      const rows = followUps.map((f) => ({
        repName: f.assignedTo
          ? `${f.assignedTo.firstName ?? ''} ${f.assignedTo.lastName ?? ''}`.trim() ||
            f.assignedTo.email
          : 'غير محدد',
        clientName: f.client.companyName || f.client.contactName,
        title: f.title,
        dueAt: f.dueAt.toISOString().split('T')[0],
        daysOverdue: Math.ceil(
          (now.getTime() - f.dueAt.getTime()) / 86_400_000,
        ),
      }));

      const summary = {
        totalOverdue: rows.length,
        avgDaysOverdue:
          rows.length > 0
            ? Math.round(
                rows.reduce((s, r) => s + (r.daysOverdue as number), 0) /
                  rows.length,
              )
            : 0,
      };

      return { rows, summary };
    },
  },
];
