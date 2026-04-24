import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

export const salesDefinitions: ReportDefinition[] = [
  {
    code: 'SALES_TEAM_PERFORMANCE',
    nameAr: 'أداء فريق المبيعات',
    nameEn: 'Sales Team Performance',
    category: 'sales',
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
      { key: 'repName', labelAr: 'المندوب', labelEn: 'Rep', type: 'string' },
      {
        key: 'leadsCount',
        labelAr: 'العملاء المحتملون',
        labelEn: 'Leads',
        type: 'number',
      },
      {
        key: 'quotesCount',
        labelAr: 'عروض الأسعار',
        labelEn: 'Quotes',
        type: 'number',
      },
      {
        key: 'winsCount',
        labelAr: 'الصفقات المُربحة',
        labelEn: 'Wins',
        type: 'number',
      },
      {
        key: 'revenue',
        labelAr: 'الإيرادات',
        labelEn: 'Revenue',
        type: 'currency',
      },
      {
        key: 'revenueTarget',
        labelAr: 'الهدف',
        labelEn: 'Target',
        type: 'currency',
      },
      {
        key: 'attainment',
        labelAr: 'نسبة التحقق',
        labelEn: 'Attainment',
        type: 'percent',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const reps = await prisma.user.findMany({
        where: { role: UserRole.SALES_REPRESENTATIVE, status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          assignedLeads: {
            where: { createdAt: { gte: from, lte: to } },
            select: { id: true },
          },
          preparedQuotes: {
            where: { createdAt: { gte: from, lte: to }, deletedAt: null },
            select: { id: true, status: true, totalAmount: true },
          },
          salesTargets: {
            where: {
              type: 'REVENUE',
              periodStart: { lte: to },
              periodEnd: { gte: from },
            },
            select: { targetValue: true },
          },
        },
      });

      const rows = reps.map((rep) => {
        const wins = rep.preparedQuotes.filter((q) => q.status === 'WON');
        const revenue = wins.reduce((s, q) => s + (q.totalAmount ?? 0), 0);
        const revenueTarget = rep.salesTargets.reduce(
          (s, t) => s + t.targetValue,
          0,
        );
        return {
          repName:
            `${rep.firstName ?? ''} ${rep.lastName ?? ''}`.trim() || rep.email,
          leadsCount: rep.assignedLeads.length,
          quotesCount: rep.preparedQuotes.length,
          winsCount: wins.length,
          revenue,
          revenueTarget,
          attainment:
            revenueTarget > 0
              ? Math.round((revenue / revenueTarget) * 100)
              : null,
        };
      });

      const summary = {
        totalReps: rows.length,
        totalRevenue: rows.reduce((s, r) => s + (r.revenue as number), 0),
        totalWins: rows.reduce((s, r) => s + (r.winsCount as number), 0),
        avgAttainment:
          rows
            .filter((r) => r.attainment != null)
            .reduce((s, r) => s + (r.attainment as number), 0) /
          (rows.filter((r) => r.attainment != null).length || 1),
      };

      return { rows, summary };
    },
  },

  {
    code: 'LEAD_SOURCE_PERFORMANCE',
    nameAr: 'أداء مصادر العملاء',
    nameEn: 'Lead Source Performance',
    category: 'sales',
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
      { key: 'channel', labelAr: 'القناة', labelEn: 'Channel', type: 'string' },
      { key: 'total', labelAr: 'الإجمالي', labelEn: 'Total', type: 'number' },
      {
        key: 'qualified',
        labelAr: 'مؤهلون',
        labelEn: 'Qualified',
        type: 'number',
      },
      {
        key: 'converted',
        labelAr: 'محولون',
        labelEn: 'Converted',
        type: 'number',
      },
      {
        key: 'conversionRate',
        labelAr: 'معدل التحويل %',
        labelEn: 'Conversion %',
        type: 'percent',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const grouped = await prisma.lead.groupBy({
        by: ['channel'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { id: true },
      });

      const qualified = await prisma.lead.groupBy({
        by: ['channel'],
        where: {
          createdAt: { gte: from, lte: to },
          status: { in: ['QUALIFIED', 'CONVERTED'] },
        },
        _count: { id: true },
      });

      const converted = await prisma.lead.groupBy({
        by: ['channel'],
        where: { createdAt: { gte: from, lte: to }, status: 'CONVERTED' },
        _count: { id: true },
      });

      const qualifiedMap = new Map(
        qualified.map((r) => [r.channel, r._count.id]),
      );
      const convertedMap = new Map(
        converted.map((r) => [r.channel, r._count.id]),
      );

      const channelLabels: Record<string, string> = {
        GOVERNMENT_TENDER: 'مناقصات حكومية',
        REFERRAL: 'إحالة',
        WALK_IN: 'زيارة مباشرة',
        SOCIAL_MEDIA: 'وسائل التواصل',
        WEBSITE: 'الموقع الإلكتروني',
        GOOGLE_MAPS: 'خرائط جوجل',
        AI_CHATBOT: 'المساعد الذكي',
      };

      const rows = grouped.map((g) => {
        const total = g._count.id;
        const conv = convertedMap.get(g.channel) ?? 0;
        return {
          channel: channelLabels[g.channel] ?? g.channel,
          total,
          qualified: qualifiedMap.get(g.channel) ?? 0,
          converted: conv,
          conversionRate: total > 0 ? Math.round((conv / total) * 100) : 0,
        };
      });

      const summary = {
        totalLeads: rows.reduce((s, r) => s + (r.total as number), 0),
        totalConverted: rows.reduce((s, r) => s + (r.converted as number), 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'WIN_LOSS_ANALYSIS',
    nameAr: 'تحليل الربح والخسارة',
    nameEn: 'Win / Loss Analysis',
    category: 'sales',
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
        key: 'outcome',
        labelAr: 'النتيجة',
        labelEn: 'Outcome',
        type: 'string',
      },
      { key: 'reason', labelAr: 'السبب', labelEn: 'Reason', type: 'string' },
      { key: 'count', labelAr: 'العدد', labelEn: 'Count', type: 'number' },
      {
        key: 'totalValue',
        labelAr: 'القيمة الإجمالية',
        labelEn: 'Total Value',
        type: 'currency',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const entries = await prisma.pipelineEntry.findMany({
        where: {
          stage: { in: ['WON', 'LOST', 'POSTPONED'] },
          closedAt: { gte: from, lte: to },
        },
        select: { stage: true, lostReason: true, estimatedValue: true },
      });

      const map = new Map<string, { count: number; totalValue: number }>();
      for (const e of entries) {
        const key =
          e.stage === 'LOST' ? `LOST:${e.lostReason ?? 'غير محدد'}` : e.stage;
        const cur = map.get(key) ?? { count: 0, totalValue: 0 };
        cur.count++;
        cur.totalValue += e.estimatedValue ?? 0;
        map.set(key, cur);
      }

      const outcomeLabels: Record<string, string> = {
        WON: 'ربح',
        LOST: 'خسارة',
        POSTPONED: 'تأجيل',
      };
      const rows = Array.from(map.entries()).map(([key, v]) => {
        const [stage, reason] = key.split(':');
        return {
          outcome: outcomeLabels[stage] ?? stage,
          reason: reason ?? '-',
          count: v.count,
          totalValue: v.totalValue,
        };
      });

      const won = entries.filter((e) => e.stage === 'WON');
      const summary = {
        wonCount: won.length,
        lostCount: entries.filter((e) => e.stage === 'LOST').length,
        postponedCount: entries.filter((e) => e.stage === 'POSTPONED').length,
        wonValue: won.reduce((s, e) => s + (e.estimatedValue ?? 0), 0),
        winRate:
          entries.length > 0
            ? Math.round((won.length / entries.length) * 100)
            : 0,
      };

      return { rows, summary };
    },
  },

  {
    code: 'PIPELINE_VELOCITY',
    nameAr: 'سرعة خط المبيعات',
    nameEn: 'Pipeline Velocity',
    category: 'sales',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      { key: 'stage', labelAr: 'المرحلة', labelEn: 'Stage', type: 'string' },
      {
        key: 'count',
        labelAr: 'العدد الحالي',
        labelEn: 'Current Count',
        type: 'number',
      },
      {
        key: 'avgDaysInStage',
        labelAr: 'متوسط الأيام',
        labelEn: 'Avg Days in Stage',
        type: 'number',
      },
      {
        key: 'totalValue',
        labelAr: 'القيمة التقديرية',
        labelEn: 'Est. Value',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const stageLabels: Record<string, string> = {
        NEW_LEAD: 'عميل جديد',
        INITIAL_CONTACT: 'تواصل أولي',
        QUALIFICATION: 'التأهيل',
        READY_FOR_RFQ: 'جاهز للطلب',
        RFQ_RECEIVED: 'تم استلام الطلب',
        QUOTE_SENT: 'تم إرسال العرض',
        NEGOTIATION: 'التفاوض',
        WON: 'ربح',
        LOST: 'خسارة',
        POSTPONED: 'تأجيل',
      };

      const grouped = await prisma.pipelineEntry.groupBy({
        by: ['stage'],
        _count: { id: true },
        _sum: { estimatedValue: true },
        _avg: {},
      });

      const rows = grouped.map((g) => ({
        stage: stageLabels[g.stage] ?? g.stage,
        count: g._count.id,
        avgDaysInStage: null,
        totalValue: g._sum.estimatedValue ?? 0,
      }));

      const summary = {
        totalOpen: grouped
          .filter((g) => !['WON', 'LOST', 'POSTPONED'].includes(g.stage))
          .reduce((s, g) => s + g._count.id, 0),
        totalPipelineValue: grouped.reduce(
          (s, g) => s + (g._sum.estimatedValue ?? 0),
          0,
        ),
      };

      return { rows, summary };
    },
  },

  {
    code: 'VISIT_ACTIVITY',
    nameAr: 'نشاط الزيارات الميدانية',
    nameEn: 'Visit Activity',
    category: 'sales',
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
      { key: 'repName', labelAr: 'المندوب', labelEn: 'Rep', type: 'string' },
      { key: 'planned', labelAr: 'مخطط', labelEn: 'Planned', type: 'number' },
      {
        key: 'completed',
        labelAr: 'منجز',
        labelEn: 'Completed',
        type: 'number',
      },
      {
        key: 'completionRate',
        labelAr: 'نسبة الإنجاز %',
        labelEn: 'Completion %',
        type: 'percent',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const visits = await prisma.fieldVisit.findMany({
        where: { scheduledAt: { gte: from, lte: to } },
        select: {
          authorId: true,
          completedAt: true,
          author: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      const repMap = new Map<
        string,
        { name: string; planned: number; completed: number }
      >();
      for (const v of visits) {
        const id = v.authorId ?? 'unknown';
        const name = v.author
          ? `${v.author.firstName ?? ''} ${v.author.lastName ?? ''}`.trim() ||
            v.author.email
          : 'غير محدد';
        const cur = repMap.get(id) ?? { name, planned: 0, completed: 0 };
        cur.planned++;
        if (v.completedAt) cur.completed++;
        repMap.set(id, cur);
      }

      const rows = Array.from(repMap.values()).map((r) => ({
        repName: r.name,
        planned: r.planned,
        completed: r.completed,
        completionRate:
          r.planned > 0 ? Math.round((r.completed / r.planned) * 100) : 0,
      }));

      const summary = {
        totalPlanned: rows.reduce((s, r) => s + (r.planned as number), 0),
        totalCompleted: rows.reduce((s, r) => s + (r.completed as number), 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'QUOTE_TURNAROUND',
    nameAr: 'وقت إعداد عروض الأسعار',
    nameEn: 'Quote Turnaround Time',
    category: 'sales',
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
        key: 'preparedBy',
        labelAr: 'المعد',
        labelEn: 'Prepared By',
        type: 'string',
      },
      {
        key: 'quotesCount',
        labelAr: 'عدد العروض',
        labelEn: 'Quotes',
        type: 'number',
      },
      {
        key: 'avgHoursToSend',
        labelAr: 'متوسط الساعات للإرسال',
        labelEn: 'Avg Hours to Send',
        type: 'number',
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
          sentAt: { not: null },
          deletedAt: null,
        },
        select: {
          createdAt: true,
          sentAt: true,
          preparedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });

      const repMap = new Map<
        string,
        { name: string; totalHours: number; count: number }
      >();
      for (const q of quotes) {
        const name = q.preparedBy
          ? `${q.preparedBy.firstName ?? ''} ${q.preparedBy.lastName ?? ''}`.trim() ||
            q.preparedBy.email
          : 'غير محدد';
        const cur = repMap.get(name) ?? { name, totalHours: 0, count: 0 };
        if (q.sentAt) {
          cur.totalHours +=
            (q.sentAt.getTime() - q.createdAt.getTime()) / 3_600_000;
        }
        cur.count++;
        repMap.set(name, cur);
      }

      const rows = Array.from(repMap.values()).map((r) => ({
        preparedBy: r.name,
        quotesCount: r.count,
        avgHoursToSend: r.count > 0 ? Math.round(r.totalHours / r.count) : 0,
      }));

      const allHours = rows.reduce(
        (s, r) => s + (r.avgHoursToSend as number) * (r.quotesCount as number),
        0,
      );
      const allCount = rows.reduce((s, r) => s + (r.quotesCount as number), 0);

      const summary = {
        totalQuotes: allCount,
        overallAvgHours: allCount > 0 ? Math.round(allHours / allCount) : 0,
      };

      return { rows, summary };
    },
  },
];
