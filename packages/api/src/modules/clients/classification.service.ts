import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientClassification, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const VIP_REVENUE_THRESHOLD = 500_000;
const DORMANT_DAYS = 180;
const NEW_CONVERTED_DAYS = 90;

type Stats = {
  lifetimeValue: number;
  lastInteractionAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  suggest(stats: Stats, now: Date = new Date()): ClientClassification {
    if (stats.lifetimeValue >= VIP_REVENUE_THRESHOLD) {
      return ClientClassification.VIP;
    }

    const dormantCutoff = new Date(
      now.getTime() - DORMANT_DAYS * 24 * 60 * 60 * 1000,
    );
    if (
      stats.lastInteractionAt &&
      stats.lastInteractionAt < dormantCutoff &&
      stats.lifetimeValue > 0
    ) {
      return ClientClassification.DORMANT;
    }

    if (stats.lifetimeValue > 0) {
      return ClientClassification.RETURNING;
    }

    const newCutoff = new Date(
      now.getTime() - NEW_CONVERTED_DAYS * 24 * 60 * 60 * 1000,
    );
    if (stats.createdAt > newCutoff) {
      return ClientClassification.NEW;
    }

    return ClientClassification.DORMANT;
  }

  async reclassifyAll(now: Date = new Date()) {
    const clients = await this.prisma.client.findMany({
      where: {
        deletedAt: null,
        classificationManual: false,
        classification: { not: ClientClassification.ARCHIVED },
      },
      select: {
        id: true,
        classification: true,
        lifetimeValue: true,
        lastInteractionAt: true,
        createdAt: true,
      },
    });

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    let changed = 0;
    for (const client of clients) {
      const next = this.suggest(client, now);
      if (next !== client.classification) {
        changed++;
        updates.push(
          this.prisma.client.update({
            where: { id: client.id },
            data: { classification: next },
          }),
        );
      }
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
      this.logger.log(
        `Classification sweep: ${changed}/${clients.length} clients reclassified`,
      );
    }

    return { scanned: clients.length, reclassified: changed };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'client-classify' })
  async scheduledRun() {
    try {
      await this.reclassifyAll();
    } catch (error) {
      this.logger.error('Classification sweep failed', error as Error);
    }
  }
}
