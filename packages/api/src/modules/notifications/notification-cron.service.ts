import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationCronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Follow-ups due today — notify the assigned rep at 08:00
  @Cron('0 8 * * *')
  async notifyFollowUpsDueToday() {
    const start = startOfToday();
    const end = endOfToday();

    const followUps = await this.prisma.followUp.findMany({
      where: {
        status: 'PENDING',
        dueAt: { gte: start, lte: end },
      },
      include: {
        client: { select: { contactName: true, companyName: true } },
        assignedTo: { select: { id: true } },
      },
    });

    for (const fu of followUps) {
      if (!fu.assignedToId) continue;
      const clientLabel =
        fu.client?.contactName ?? fu.client?.companyName ?? fu.clientId;
      void this.notifications.send({
        recipientId: fu.assignedToId,
        eventCode: 'followup.due_today',
        subject: `متابعة مستحقة اليوم — ${clientLabel}`,
        body: fu.notes ?? 'لديك متابعة مجدولة اليوم',
        deepLink: `/clients/${fu.clientId}`,
        payload: { followUpId: fu.id, clientId: fu.clientId },
      });
    }
  }

  // Overdue follow-ups — notify rep + manager at 08:00
  @Cron('0 8 * * *')
  async notifyOverdueFollowUps() {
    const start = startOfToday();

    const followUps = await this.prisma.followUp.findMany({
      where: {
        status: 'PENDING',
        dueAt: { lt: start },
      },
      include: {
        client: { select: { contactName: true, companyName: true } },
        assignedTo: { select: { id: true } },
      },
      take: 200,
    });

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['SALES_MANAGER', 'ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    for (const fu of followUps) {
      if (!fu.assignedToId) continue;
      const clientLabel =
        fu.client?.contactName ?? fu.client?.companyName ?? fu.clientId;
      const recipients = Array.from(new Set([fu.assignedToId, ...managerIds]));
      void this.notifications.sendToMany(recipients, {
        eventCode: 'followup.overdue',
        subject: `متابعة متأخرة — ${clientLabel}`,
        body: `كان موعد هذه المتابعة ${fu.dueAt.toLocaleDateString('ar-SA')}`,
        deepLink: `/clients/${fu.clientId}`,
        payload: { followUpId: fu.id, clientId: fu.clientId },
      });
    }
  }

  // Quotes expiring in 3 days — notify preparer at 08:00
  @Cron('0 8 * * *')
  async notifyQuoteExpirySoon() {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const windowStart = new Date(in3Days);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(in3Days);
    windowEnd.setHours(23, 59, 59, 999);

    const quotes = await this.prisma.quote.findMany({
      where: {
        deletedAt: null,
        validUntil: { gte: windowStart, lte: windowEnd },
        status: { in: ['SENT', 'IN_DISCUSSION', 'IN_NEGOTIATION'] },
      },
      select: {
        id: true,
        quoteNumber: true,
        preparedById: true,
        validUntil: true,
      },
    });

    for (const q of quotes) {
      if (!q.preparedById) continue;
      void this.notifications.send({
        recipientId: q.preparedById,
        eventCode: 'quote.expiry_3d',
        subject: `عرض السعر ينتهي خلال 3 أيام: ${q.quoteNumber}`,
        body: `تاريخ الانتهاء: ${q.validUntil?.toLocaleDateString('ar-SA')}`,
        deepLink: `/quotes/${q.id}`,
        payload: { quoteId: q.id, quoteNumber: q.quoteNumber },
      });
    }
  }

  // RFQs unassigned for > 4 hours — notify managers every hour
  @Cron(CronExpression.EVERY_HOUR)
  async notifyUnassignedRfqs() {
    const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const rfqs = await this.prisma.rfq.findMany({
      where: {
        status: 'RECEIVED',
        assignedToId: null,
        createdAt: { lt: threshold },
      },
      select: { id: true, rfqNumber: true },
      take: 50,
    });

    if (rfqs.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    void this.notifications.sendToMany(
      managers.map((m) => m.id),
      {
        eventCode: 'rfq.unassigned_4h',
        subject: `${rfqs.length} طلب عرض سعر بلا مهندس`,
        body: rfqs.map((r) => r.rfqNumber).join('، '),
        deepLink: '/pipeline',
        payload: { rfqIds: rfqs.map((r) => r.id) },
      },
    );
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
