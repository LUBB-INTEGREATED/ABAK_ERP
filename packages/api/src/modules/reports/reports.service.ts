import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ReportFilters,
  ReportResult,
} from './report-definition.interface';
import { REPORT_REGISTRY } from './reports.registry';
import type { CreateSavedReportDto } from './dto';

@Injectable()
export class ReportsService {
  private kpiCache: { data: unknown; expiry: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  catalog(role: UserRole) {
    const defs = Array.from(REPORT_REGISTRY.values()).filter((d) =>
      d.minRoles.includes(role),
    );

    const categories = new Map<string, typeof defs>();
    for (const d of defs) {
      const arr = categories.get(d.category) ?? [];
      arr.push(d);
      categories.set(d.category, arr);
    }

    return Array.from(categories.entries()).map(([category, reports]) => ({
      category,
      reports: reports.map((r) => ({
        code: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        filters: r.filters,
        columns: r.columns,
      })),
    }));
  }

  async run(
    code: string,
    filters: ReportFilters,
    role: UserRole,
  ): Promise<ReportResult> {
    const def = REPORT_REGISTRY.get(code);
    if (!def) throw new NotFoundException(`Report ${code} not found`);
    if (!def.minRoles.includes(role)) throw new ForbiddenException();

    const { rows, summary } = await def.run(this.prisma, filters);

    return {
      rows,
      summary,
      meta: {
        reportCode: code,
        generatedAt: new Date().toISOString(),
        filters,
        totalRows: rows.length,
        columns: def.columns,
      },
    };
  }

  async exportCsv(
    code: string,
    filters: ReportFilters,
    role: UserRole,
  ): Promise<string> {
    const result = await this.run(code, filters, role);
    const { columns, rows } =
      result.meta.columns.length > 0
        ? { columns: result.meta.columns, rows: result.rows }
        : { columns: [], rows: result.rows };

    const header = columns.map((c) => c.labelAr).join(',');
    const lines = rows.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          if (val == null) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    );

    return [header, ...lines].join('\n');
  }

  // ─── Saved reports ────────────────────────────────────────────

  listSavedReports(ownerId: string) {
    return this.prisma.savedReport.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSavedReport(ownerId: string, dto: CreateSavedReportDto) {
    if (!REPORT_REGISTRY.has(dto.reportCode)) {
      throw new NotFoundException(`Report ${dto.reportCode} not found`);
    }
    return this.prisma.savedReport.create({
      data: {
        ownerId,
        reportCode: dto.reportCode,
        name: dto.name,
        filters: dto.filters,
        scheduledCron: dto.scheduledCron,
        recipients: dto.recipients ?? [],
      },
    });
  }

  async deleteSavedReport(id: string, ownerId: string) {
    const report = await this.prisma.savedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException();
    if (report.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.savedReport.delete({ where: { id } });
  }

  // ─── Executive KPIs (M10-008) ─────────────────────────────────

  async executiveKpis(role: UserRole) {
    const allowed: UserRole[] = [
      'SUPER_ADMIN',
      'ADMIN',
      'SALES_MANAGER',
      'FINANCE_MANAGER',
    ] as UserRole[];

    if (!allowed.includes(role)) throw new ForbiddenException();

    if (this.kpiCache && Date.now() < this.kpiCache.expiry) {
      return this.kpiCache.data;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const trailing90 = new Date(Date.now() - 90 * 86_400_000);

    const [
      monthWonQuotes,
      monthRevTarget,
      pipelineStages,
      recentClosed,
      invoiceAggregate,
      paymentAggregate,
      activeProjects,
      atRiskProjects,
      openGovTx,
      awaitingGovTx,
      salesTargets,
      commissionAccruing,
    ] = await Promise.all([
      this.prisma.quote.aggregate({
        where: { status: 'WON', wonAt: { gte: startOfMonth }, deletedAt: null },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.salesTarget.aggregate({
        where: {
          type: 'REVENUE',
          period: 'MONTHLY',
          periodStart: { lte: now },
          periodEnd: { gte: startOfMonth },
        },
        _sum: { targetValue: true },
      }),
      this.prisma.pipelineEntry.groupBy({
        by: ['stage'],
        _count: { id: true },
        _sum: { estimatedValue: true },
      }),
      this.prisma.pipelineEntry.findMany({
        where: {
          stage: { in: ['WON', 'LOST'] },
          closedAt: { gte: trailing90 },
        },
        select: { stage: true },
      }),
      this.prisma.invoice.aggregate({
        where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          validationStatus: 'VALIDATED',
          validatedAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.project.count({
        where: {
          status: {
            in: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'AT_RISK', 'CLOSING'],
          },
        },
      }),
      this.prisma.project.count({
        where: { OR: [{ status: 'AT_RISK' }, { financialRiskFlagged: true }] },
      }),
      this.prisma.govTransaction.count({
        where: { status: { notIn: ['APPROVED', 'REJECTED', 'CANCELLED'] } },
      }),
      this.prisma.govTransaction.count({
        where: { status: 'REVISION_REQUIRED' },
      }),
      this.prisma.salesTarget.findMany({
        where: {
          type: 'REVENUE',
          period: 'MONTHLY',
          periodStart: { lte: now },
          periodEnd: { gte: startOfMonth },
        },
        select: { ownerId: true, targetValue: true, achievedValue: true },
      }),
      this.prisma.commission.aggregate({
        where: { status: 'ACCRUING' },
        _sum: { amount: true },
      }),
    ]);

    const wonCount = recentClosed.filter((e) => e.stage === 'WON').length;
    const lostCount = recentClosed.filter((e) => e.stage === 'LOST').length;
    const winRate =
      wonCount + lostCount > 0
        ? Math.round((wonCount / (wonCount + lostCount)) * 100)
        : 0;

    const monthRevActual = monthWonQuotes._sum.totalAmount ?? 0;
    const monthRevTargetVal = monthRevTarget._sum.targetValue ?? 0;

    const pipelineFunnel = pipelineStages.map((g) => ({
      stage: g.stage,
      count: g._count.id,
      value: g._sum.estimatedValue ?? 0,
    }));

    const invoicedTotal = invoiceAggregate._sum.totalAmount ?? 0;
    const collectedMonth = paymentAggregate._sum.amount ?? 0;
    const collectionEfficiency =
      invoicedTotal > 0
        ? Math.round((collectedMonth / invoicedTotal) * 100)
        : 0;

    const repAttainments = salesTargets.map((t) => ({
      ownerId: t.ownerId,
      attainment:
        t.targetValue > 0
          ? Math.round((t.achievedValue / t.targetValue) * 100)
          : 0,
    }));

    const data = {
      monthlyRevenue: { actual: monthRevActual, target: monthRevTargetVal },
      winRate,
      pipelineFunnel,
      collectionEfficiency,
      openInvoicesCount: invoiceAggregate._count.id,
      openInvoicesValue: invoicedTotal,
      activeProjectsCount: activeProjects,
      atRiskProjectsCount: atRiskProjects,
      openGovTransactionsCount: openGovTx,
      awaitingResponseGovCount: awaitingGovTx,
      repAttainments,
      commissionAccruing: commissionAccruing._sum.amount ?? 0,
      generatedAt: new Date().toISOString(),
    };

    this.kpiCache = { data, expiry: Date.now() + 60_000 };
    return data;
  }
}
