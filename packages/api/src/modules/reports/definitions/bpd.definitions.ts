import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

/**
 * BPD-specified reports that complement the existing definitions.
 *
 * Already covered elsewhere:
 *   LEAD_SOURCE_PERFORMANCE  → channel performance (sales.definitions)
 *   WIN_LOSS_ANALYSIS        → win/loss (sales.definitions)
 *   QUOTE_TURNAROUND         → quote turnaround (sales.definitions)
 *
 * Added here (genuinely new):
 *   SALES_REP_ACTIVITY  — per-rep activity breakdown (leads, interactions, visits, quotes, follow-ups)
 *   TENDER_TRACKER      — active government-tender leads with deadline visibility
 */
export const bpdDefinitions: ReportDefinition[] = [
  // ─── Sales Rep Activity ────────────────────────────────────────────
  {
    code: 'SALES_REP_ACTIVITY',
    nameAr: 'نشاط مندوبي المبيعات',
    nameEn: 'Sales Rep Activity Report',
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
        key: 'leadsAssigned',
        labelAr: 'العملاء المحتملون المُعيَّنون',
        labelEn: 'Leads Assigned',
        type: 'number',
      },
      {
        key: 'interactionsLogged',
        labelAr: 'التفاعلات المُسجَّلة',
        labelEn: 'Interactions Logged',
        type: 'number',
      },
      {
        key: 'fieldVisits',
        labelAr: 'الزيارات الميدانية',
        labelEn: 'Field Visits',
        type: 'number',
      },
      {
        key: 'quotesCreated',
        labelAr: 'عروض الأسعار المُنشأة',
        labelEn: 'Quotes Created',
        type: 'number',
      },
      {
        key: 'followUpsCompleted',
        labelAr: 'المتابعات المنجزة',
        labelEn: 'Follow-ups Completed',
        type: 'number',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const reps = await prisma.user.findMany({
        where: {
          role: UserRole.SALES_REPRESENTATIVE,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          // leads assigned in range
          assignedLeads: {
            where: { assignedAt: { gte: from, lte: to } },
            select: { id: true },
          },
          // interactions logged in range
          loggedInteractions: {
            where: { occurredAt: { gte: from, lte: to } },
            select: { id: true },
          },
          // field visits in range
          loggedVisits: {
            where: { scheduledAt: { gte: from, lte: to } },
            select: { id: true },
          },
          // quotes created in range
          preparedQuotes: {
            where: { createdAt: { gte: from, lte: to }, deletedAt: null },
            select: { id: true },
          },
          // follow-ups completed in range
          assignedFollowUps: {
            where: {
              completedAt: { gte: from, lte: to },
              status: 'COMPLETED',
            },
            select: { id: true },
          },
        },
      });

      const rows = reps.map((rep) => ({
        repName:
          `${rep.firstName ?? ''} ${rep.lastName ?? ''}`.trim() || rep.email,
        leadsAssigned: rep.assignedLeads.length,
        interactionsLogged: rep.loggedInteractions.length,
        fieldVisits: rep.loggedVisits.length,
        quotesCreated: rep.preparedQuotes.length,
        followUpsCompleted: rep.assignedFollowUps.length,
      }));

      const summary = {
        totalReps: rows.length,
        totalLeads: rows.reduce((s, r) => s + r.leadsAssigned, 0),
        totalInteractions: rows.reduce((s, r) => s + r.interactionsLogged, 0),
        totalVisits: rows.reduce((s, r) => s + r.fieldVisits, 0),
        totalQuotes: rows.reduce((s, r) => s + r.quotesCreated, 0),
        totalFollowUps: rows.reduce((s, r) => s + r.followUpsCompleted, 0),
      };

      return { rows, summary };
    },
  },

  // ─── Tender Tracker ────────────────────────────────────────────────
  {
    code: 'TENDER_TRACKER',
    nameAr: 'متابعة المناقصات الحكومية',
    nameEn: 'Tender Tracker',
    category: 'sales',
    minRoles: [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SALES_MANAGER,
      UserRole.SALES_REPRESENTATIVE,
    ],
    filters: [],
    columns: [
      {
        key: 'leadNumber',
        labelAr: 'رقم العميل المحتمل',
        labelEn: 'Lead #',
        type: 'string',
      },
      {
        key: 'title',
        labelAr: 'العنوان',
        labelEn: 'Title',
        type: 'string',
      },
      {
        key: 'deadline',
        labelAr: 'الموعد النهائي',
        labelEn: 'Deadline',
        type: 'date',
      },
      {
        key: 'daysLeft',
        labelAr: 'الأيام المتبقية',
        labelEn: 'Days Left',
        type: 'number',
      },
      {
        key: 'status',
        labelAr: 'الحالة',
        labelEn: 'Status',
        type: 'string',
      },
      {
        key: 'assignee',
        labelAr: 'المسؤول',
        labelEn: 'Assignee',
        type: 'string',
      },
      {
        key: 'estimatedValue',
        labelAr: 'القيمة التقديرية',
        labelEn: 'Est. Value',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const now = new Date();

      const leads = await prisma.lead.findMany({
        where: {
          status: {
            in: ['TENDER_PENDING', 'TENDER_ACTIVE', 'TENDER_SUBMITTED'],
          },
          deletedAt: null,
        },
        select: {
          leadNumber: true,
          contactName: true,
          companyName: true,
          tenderDeadline: true,
          status: true,
          budget: true,
          assignedTo: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { tenderDeadline: 'asc' },
      });

      const statusLabels: Record<string, string> = {
        TENDER_PENDING: 'في انتظار التقديم',
        TENDER_ACTIVE: 'نشط',
        TENDER_SUBMITTED: 'تم التقديم',
      };

      const rows = leads.map((l) => {
        const daysLeft = l.tenderDeadline
          ? Math.ceil((l.tenderDeadline.getTime() - now.getTime()) / 86_400_000)
          : null;
        return {
          leadNumber: l.leadNumber,
          title: l.companyName || l.contactName,
          deadline: l.tenderDeadline?.toISOString().split('T')[0] ?? '-',
          daysLeft,
          status: statusLabels[l.status] ?? l.status,
          assignee: l.assignedTo
            ? `${l.assignedTo.firstName ?? ''} ${l.assignedTo.lastName ?? ''}`.trim() ||
              l.assignedTo.email
            : 'غير مُعيَّن',
          estimatedValue: l.budget ?? 0,
        };
      });

      const overdueCount = rows.filter(
        (r) => r.daysLeft !== null && (r.daysLeft as number) < 0,
      ).length;
      const urgentCount = rows.filter(
        (r) =>
          r.daysLeft !== null &&
          (r.daysLeft as number) >= 0 &&
          (r.daysLeft as number) <= 3,
      ).length;

      const summary = {
        total: rows.length,
        overdueOrMissed: overdueCount,
        urgentWithin3Days: urgentCount,
        totalEstimatedValue: rows.reduce(
          (s, r) => s + (r.estimatedValue as number),
          0,
        ),
      };

      return { rows, summary };
    },
  },
];
