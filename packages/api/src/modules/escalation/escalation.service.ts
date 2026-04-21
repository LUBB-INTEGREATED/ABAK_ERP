import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // trigger/resolve — idempotent entry points that business services call.
  async trigger(
    ruleCode: string,
    resource: string,
    resourceId: string,
  ): Promise<void> {
    const rule = await this.prisma.escalationRule.findUnique({
      where: { code: ruleCode },
    });
    if (!rule || !rule.enabled) return;
    await this.prisma.escalationInstance.upsert({
      where: {
        ruleId_resource_resourceId: {
          ruleId: rule.id,
          resource,
          resourceId,
        },
      },
      create: {
        ruleId: rule.id,
        resource,
        resourceId,
        triggeredAt: new Date(),
      },
      update: {
        // already tracking — leave existing state
      },
    });
  }

  async resolve(
    ruleCode: string,
    resource: string,
    resourceId: string,
    reason: string,
  ): Promise<void> {
    const rule = await this.prisma.escalationRule.findUnique({
      where: { code: ruleCode },
    });
    if (!rule) return;
    await this.prisma.escalationInstance.updateMany({
      where: { ruleId: rule.id, resource, resourceId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedReason: reason },
    });
  }

  list(includeResolved = false) {
    return this.prisma.escalationInstance.findMany({
      where: includeResolved ? {} : { resolvedAt: null },
      include: { rule: true },
      orderBy: { triggeredAt: 'desc' },
    });
  }

  listRules() {
    return this.prisma.escalationRule.findMany({
      orderBy: { code: 'asc' },
    });
  }

  // Cron — every 15 minutes advance levels on open instances.
  @Cron(CronExpression.EVERY_30_MINUTES)
  async advanceLevels() {
    const now = Date.now();
    const open = await this.prisma.escalationInstance.findMany({
      where: { resolvedAt: null },
      include: { rule: true },
    });
    for (const inst of open) {
      if (!inst.rule.enabled) continue;
      const anchor = (inst.lastEscalatedAt ?? inst.triggeredAt).getTime();
      const delayHours =
        inst.currentLevel === 0
          ? inst.rule.level1DelayHours
          : inst.currentLevel === 1
            ? inst.rule.level2DelayHours
            : inst.currentLevel === 2
              ? inst.rule.level3DelayHours
              : Infinity;
      if (now - anchor < delayHours * 3600 * 1000) continue;
      if (inst.currentLevel >= 3) continue;

      const nextLevel = inst.currentLevel + 1;
      await this.prisma.escalationInstance.update({
        where: { id: inst.id },
        data: { currentLevel: nextLevel, lastEscalatedAt: new Date() },
      });

      // Notify managers (simplified selector handling)
      const selector =
        nextLevel === 1
          ? inst.rule.level1RecipientSelector
          : nextLevel === 2
            ? inst.rule.level2RecipientSelector
            : inst.rule.level3RecipientSelector;
      const recipients = await this.resolveRecipients(selector);
      if (recipients.length > 0) {
        await this.notifications.sendToMany(recipients, {
          eventCode: `escalation.level${nextLevel}.${inst.rule.code.toLowerCase()}`,
          subject: `تصعيد المستوى ${nextLevel}: ${inst.rule.name}`,
          body: `يتطلب اهتمامك العاجل — المورد: ${inst.resource} ${inst.resourceId}`,
          priority: nextLevel === 3 ? 'URGENT' : 'HIGH',
          deepLink: `/admin/audit`,
        });
      }
      this.logger.log(
        `Escalation advanced: ${inst.rule.code} → L${nextLevel} for ${inst.resource}:${inst.resourceId}`,
      );
    }
  }

  private async resolveRecipients(selector: string): Promise<string[]> {
    // Simple selector vocabulary: "role:ROLE" or "user:ID"
    if (selector.startsWith('role:')) {
      const role = selector.slice(5);
      const users = await this.prisma.user.findMany({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { role: role as any, status: 'ACTIVE' },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (selector.startsWith('user:')) {
      return [selector.slice(5)];
    }
    return [];
  }
}
