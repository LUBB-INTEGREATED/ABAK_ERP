import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadStatus, Prisma, SLAStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DUE_SOON_HOURS = 4;

const NON_TERMINAL_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.ASSIGNED,
  LeadStatus.CONTACTED,
  LeadStatus.QUALIFIED,
];

type SlaInputs = {
  slaResponseDue: Date | null;
  firstResponseAt: Date | null;
};

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure calculator so callers outside the cron (e.g. tests) can reuse it.
   */
  calculate(lead: SlaInputs, now: Date = new Date()): SLAStatus {
    if (lead.firstResponseAt) return SLAStatus.ON_TIME;
    if (!lead.slaResponseDue) return SLAStatus.ON_TIME;

    const hoursUntilDue =
      (lead.slaResponseDue.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) return SLAStatus.OVERDUE;
    if (hoursUntilDue <= DUE_SOON_HOURS) return SLAStatus.DUE_SOON;
    return SLAStatus.ON_TIME;
  }

  async recomputeAll(now: Date = new Date()) {
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: NON_TERMINAL_STATUSES },
        firstResponseAt: null,
        slaResponseDue: { not: null },
      },
      select: {
        id: true,
        slaStatus: true,
        slaResponseDue: true,
        firstResponseAt: true,
      },
    });

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    const transitions = { toOnTime: 0, toDueSoon: 0, toOverdue: 0 };

    for (const lead of leads) {
      const next = this.calculate(lead, now);
      if (next === lead.slaStatus) continue;
      if (next === SLAStatus.ON_TIME) transitions.toOnTime++;
      if (next === SLAStatus.DUE_SOON) transitions.toDueSoon++;
      if (next === SLAStatus.OVERDUE) transitions.toOverdue++;
      updates.push(
        this.prisma.lead.update({
          where: { id: lead.id },
          data: { slaStatus: next },
        }),
      );
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
      this.logger.log(
        `SLA recompute: ${updates.length} transitioned (` +
          `+${transitions.toDueSoon} due-soon, ` +
          `+${transitions.toOverdue} overdue, ` +
          `${transitions.toOnTime} back-to-on-time)`,
      );
    }

    return { scanned: leads.length, transitioned: updates.length };
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'lead-sla-recompute' })
  async scheduledRecompute() {
    try {
      await this.recomputeAll();
    } catch (error) {
      this.logger.error('SLA recompute failed', error as Error);
    }
  }
}
