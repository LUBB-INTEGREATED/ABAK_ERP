import { UserRole } from '@prisma/client';
import type { ReportDefinition } from '../report-definition.interface';

export const projectDefinitions: ReportDefinition[] = [
  {
    code: 'ACTIVE_PROJECTS_OVERVIEW',
    nameAr: 'نظرة عامة على المشاريع النشطة',
    nameEn: 'Active Projects Overview',
    category: 'project',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'projectNumber',
        labelAr: 'رقم المشروع',
        labelEn: 'Project #',
        type: 'string',
      },
      { key: 'title', labelAr: 'العنوان', labelEn: 'Title', type: 'string' },
      { key: 'client', labelAr: 'العميل', labelEn: 'Client', type: 'string' },
      { key: 'pm', labelAr: 'مدير المشروع', labelEn: 'PM', type: 'string' },
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      {
        key: 'progress',
        labelAr: 'التقدم %',
        labelEn: 'Progress %',
        type: 'percent',
      },
      {
        key: 'contractValue',
        labelAr: 'قيمة العقد',
        labelEn: 'Contract Value',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const projects = await prisma.project.findMany({
        where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
        select: {
          projectNumber: true,
          title: true,
          status: true,
          actualProgress: true,
          contractValue: true,
          client: { select: { contactName: true, companyName: true } },
          pm: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const statusLabels: Record<string, string> = {
        PLANNING: 'تخطيط',
        ACTIVE: 'نشط',
        ON_HOLD: 'متوقف',
        AT_RISK: 'في خطر',
        CLOSING: 'إغلاق',
      };

      const rows = projects.map((p) => ({
        projectNumber: p.projectNumber,
        title: p.title,
        client: p.client.companyName || p.client.contactName,
        pm: p.pm
          ? `${p.pm.firstName ?? ''} ${p.pm.lastName ?? ''}`.trim() ||
            p.pm.email
          : '-',
        status: statusLabels[p.status] ?? p.status,
        progress: p.actualProgress,
        contractValue: p.contractValue,
      }));

      const summary = {
        totalActive: rows.length,
        atRiskCount: projects.filter((p) => p.status === 'AT_RISK').length,
        totalContractValue: projects.reduce((s, p) => s + p.contractValue, 0),
      };

      return { rows, summary };
    },
  },

  {
    code: 'PHASE_DURATION_ANALYSIS',
    nameAr: 'تحليل مدة المراحل',
    nameEn: 'Phase Duration Analysis',
    category: 'project',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'phaseCode',
        labelAr: 'كود المرحلة',
        labelEn: 'Phase Code',
        type: 'string',
      },
      {
        key: 'projectNumber',
        labelAr: 'رقم المشروع',
        labelEn: 'Project #',
        type: 'string',
      },
      {
        key: 'plannedDays',
        labelAr: 'الأيام المخططة',
        labelEn: 'Planned Days',
        type: 'number',
      },
      {
        key: 'actualDays',
        labelAr: 'الأيام الفعلية',
        labelEn: 'Actual Days',
        type: 'number',
      },
      {
        key: 'variance',
        labelAr: 'الفارق (يوم)',
        labelEn: 'Variance (days)',
        type: 'number',
      },
    ],
    async run(prisma) {
      const phases = await prisma.phase.findMany({
        where: { actualStart: { not: null } },
        select: {
          phaseCode: true,
          plannedStart: true,
          plannedEnd: true,
          actualStart: true,
          actualEnd: true,
          project: { select: { projectNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      const rows = phases.map((ph) => {
        const plannedDays = Math.ceil(
          (ph.plannedEnd.getTime() - ph.plannedStart.getTime()) / 86_400_000,
        );
        const endRef = ph.actualEnd ?? new Date();
        const actualDays = Math.ceil(
          (endRef.getTime() -
            (ph.actualStart?.getTime() ?? ph.plannedStart.getTime())) /
            86_400_000,
        );
        return {
          phaseCode: ph.phaseCode,
          projectNumber: ph.project.projectNumber,
          plannedDays,
          actualDays,
          variance: actualDays - plannedDays,
        };
      });

      const overdue = rows.filter((r) => (r.variance as number) > 0);
      const summary = {
        totalPhases: rows.length,
        overdueCount: overdue.length,
        avgVarianceDays:
          rows.length > 0
            ? Math.round(
                rows.reduce((s, r) => s + (r.variance as number), 0) /
                  rows.length,
              )
            : 0,
      };

      return { rows, summary };
    },
  },

  {
    code: 'PROJECT_WORKLOAD',
    nameAr: 'عبء العمل بالمشاريع',
    nameEn: 'Project Workload',
    category: 'project',
    minRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER],
    filters: [],
    columns: [
      {
        key: 'memberName',
        labelAr: 'العضو',
        labelEn: 'Member',
        type: 'string',
      },
      {
        key: 'openTasks',
        labelAr: 'المهام المفتوحة',
        labelEn: 'Open Tasks',
        type: 'number',
      },
      {
        key: 'completedTasks',
        labelAr: 'المهام المكتملة',
        labelEn: 'Completed Tasks',
        type: 'number',
      },
      {
        key: 'projectsCount',
        labelAr: 'عدد المشاريع',
        labelEn: 'Projects',
        type: 'number',
      },
    ],
    async run(prisma) {
      const tasks = await prisma.task.findMany({
        where: { assigneeId: { not: null } },
        select: {
          status: true,
          projectId: true,
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      const map = new Map<
        string,
        { name: string; open: number; completed: number; projects: Set<string> }
      >();
      for (const t of tasks) {
        if (!t.assignee) continue;
        const id = t.assignee.id;
        const name =
          `${t.assignee.firstName ?? ''} ${t.assignee.lastName ?? ''}`.trim() ||
          t.assignee.email;
        const cur = map.get(id) ?? {
          name,
          open: 0,
          completed: 0,
          projects: new Set<string>(),
        };
        if (t.status === 'DONE') cur.completed++;
        else cur.open++;
        if (t.projectId) cur.projects.add(t.projectId);
        map.set(id, cur);
      }

      const rows = Array.from(map.values()).map((m) => ({
        memberName: m.name,
        openTasks: m.open,
        completedTasks: m.completed,
        projectsCount: m.projects.size,
      }));

      rows.sort((a, b) => (b.openTasks as number) - (a.openTasks as number));

      const summary = {
        totalOpenTasks: rows.reduce((s, r) => s + (r.openTasks as number), 0),
        totalCompletedTasks: rows.reduce(
          (s, r) => s + (r.completedTasks as number),
          0,
        ),
        teamSize: rows.length,
      };

      return { rows, summary };
    },
  },

  {
    code: 'PROJECT_CLOSURE_REPORT',
    nameAr: 'تقرير إغلاق المشاريع',
    nameEn: 'Project Closure Report',
    category: 'project',
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
      {
        key: 'projectNumber',
        labelAr: 'رقم المشروع',
        labelEn: 'Project #',
        type: 'string',
      },
      { key: 'title', labelAr: 'العنوان', labelEn: 'Title', type: 'string' },
      { key: 'client', labelAr: 'العميل', labelEn: 'Client', type: 'string' },
      {
        key: 'contractValue',
        labelAr: 'قيمة العقد',
        labelEn: 'Contract Value',
        type: 'currency',
      },
      {
        key: 'totalInvoiced',
        labelAr: 'إجمالي الفواتير',
        labelEn: 'Total Invoiced',
        type: 'currency',
      },
      {
        key: 'actualEndDate',
        labelAr: 'تاريخ الإغلاق الفعلي',
        labelEn: 'Actual End',
        type: 'date',
      },
    ],
    async run(prisma, filters) {
      const from = filters.from
        ? new Date(filters.from)
        : new Date(new Date().getFullYear(), 0, 1);
      const to = filters.to ? new Date(filters.to) : new Date();

      const projects = await prisma.project.findMany({
        where: { status: 'CLOSED', actualEndDate: { gte: from, lte: to } },
        select: {
          projectNumber: true,
          title: true,
          contractValue: true,
          actualEndDate: true,
          client: { select: { contactName: true, companyName: true } },
          invoices: { select: { totalAmount: true } },
        },
        orderBy: { actualEndDate: 'desc' },
      });

      const rows = projects.map((p) => ({
        projectNumber: p.projectNumber,
        title: p.title,
        client: p.client.companyName || p.client.contactName,
        contractValue: p.contractValue,
        totalInvoiced: p.invoices.reduce((s, i) => s + i.totalAmount, 0),
        actualEndDate: p.actualEndDate?.toISOString().split('T')[0],
      }));

      const summary = {
        closedCount: rows.length,
        totalContractValue: rows.reduce(
          (s, r) => s + (r.contractValue as number),
          0,
        ),
        totalInvoiced: rows.reduce(
          (s, r) => s + (r.totalInvoiced as number),
          0,
        ),
      };

      return { rows, summary };
    },
  },

  {
    code: 'AT_RISK_PROJECTS',
    nameAr: 'المشاريع في خطر',
    nameEn: 'At-Risk Projects',
    category: 'project',
    minRoles: [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SALES_MANAGER,
      UserRole.FINANCE_MANAGER,
    ],
    filters: [],
    columns: [
      {
        key: 'projectNumber',
        labelAr: 'رقم المشروع',
        labelEn: 'Project #',
        type: 'string',
      },
      { key: 'title', labelAr: 'العنوان', labelEn: 'Title', type: 'string' },
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status', type: 'string' },
      {
        key: 'financialRisk',
        labelAr: 'خطر مالي',
        labelEn: 'Financial Risk',
        type: 'string',
      },
      {
        key: 'riskReason',
        labelAr: 'سبب الخطر',
        labelEn: 'Risk Reason',
        type: 'string',
      },
      {
        key: 'contractValue',
        labelAr: 'قيمة العقد',
        labelEn: 'Contract Value',
        type: 'currency',
      },
    ],
    async run(prisma) {
      const projects = await prisma.project.findMany({
        where: { OR: [{ status: 'AT_RISK' }, { financialRiskFlagged: true }] },
        select: {
          projectNumber: true,
          title: true,
          status: true,
          financialRiskFlagged: true,
          financialRiskReason: true,
          contractValue: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const rows = projects.map((p) => ({
        projectNumber: p.projectNumber,
        title: p.title,
        status: p.status,
        financialRisk: p.financialRiskFlagged ? 'نعم' : 'لا',
        riskReason: p.financialRiskReason ?? '-',
        contractValue: p.contractValue,
      }));

      const summary = {
        total: rows.length,
        atRiskStatus: projects.filter((p) => p.status === 'AT_RISK').length,
        financialRisk: projects.filter((p) => p.financialRiskFlagged).length,
      };

      return { rows, summary };
    },
  },
];
