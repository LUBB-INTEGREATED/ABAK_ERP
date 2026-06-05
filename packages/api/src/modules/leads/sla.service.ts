import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadStatus, Prisma, SLAStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DUE_SOON_HOURS = 4;

const NON_TERMINAL_STATUSES: LeadStatus[] = [
  LeadStatus.INCOMING,
  LeadStatus.ASSIGNED,
  LeadStatus.IN_PROGRESS,
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
    // A-26: the SLA status of every scanned lead is fully derivable from
    // `slaResponseDue` vs `now` (the rows are pre-filtered to firstResponseAt
    // == null and slaResponseDue != null, so calculate() never takes its
    // ON_TIME early-returns). That lets us replace the per-row update loop with
    // three set-based updateMany calls — one per target status — bucketed by
    // the SAME date math calculate() uses:
    //   OVERDUE  : slaResponseDue <  now                       (hoursUntilDue < 0)
    //   DUE_SOON : now <= slaResponseDue <= now + DUE_SOON_HOURS (0 <= h <= 4)
    //   ON_TIME  : slaResponseDue >  now + DUE_SOON_HOURS        (h > 4)
    // Each updateMany also requires `slaStatus != <target>` so only genuine
    // transitions are written and counted (mirrors the old `next === current`
    // skip). The scan stays index-backed via @@index([slaStatus]) / status.
    const dueSoonCutoff = new Date(
      now.getTime() + DUE_SOON_HOURS * 60 * 60 * 1000,
    );

    const base: Prisma.LeadWhereInput = {
      deletedAt: null,
      status: { in: NON_TERMINAL_STATUSES },
      firstResponseAt: null,
      slaResponseDue: { not: null },
    };

    const [overdue, dueSoon, onTime] = await this.prisma.$transaction([
      this.prisma.lead.updateMany({
        where: {
          ...base,
          slaStatus: { not: SLAStatus.OVERDUE },
          slaResponseDue: { lt: now },
        },
        data: { slaStatus: SLAStatus.OVERDUE },
      }),
      this.prisma.lead.updateMany({
        where: {
          ...base,
          slaStatus: { not: SLAStatus.DUE_SOON },
          slaResponseDue: { gte: now, lte: dueSoonCutoff },
        },
        data: { slaStatus: SLAStatus.DUE_SOON },
      }),
      this.prisma.lead.updateMany({
        where: {
          ...base,
          slaStatus: { not: SLAStatus.ON_TIME },
          slaResponseDue: { gt: dueSoonCutoff },
        },
        data: { slaStatus: SLAStatus.ON_TIME },
      }),
    ]);

    const transitioned = overdue.count + dueSoon.count + onTime.count;

    if (transitioned > 0) {
      this.logger.log(
        `SLA recompute: ${transitioned} transitioned (` +
          `+${dueSoon.count} due-soon, ` +
          `+${overdue.count} overdue, ` +
          `${onTime.count} back-to-on-time)`,
      );
    }

    return { transitioned };
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
