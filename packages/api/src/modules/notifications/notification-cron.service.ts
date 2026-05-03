import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadChannel, QuoteStatus } from '@prisma/client';
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

  // Quote auto-expiry — mark EXPIRED when validUntil < now (daily at 01:00)
  @Cron('0 1 * * *')
  async expireOverdueQuotes() {
    const now = new Date();
    const candidates = await this.prisma.quote.findMany({
      where: {
        deletedAt: null,
        validUntil: { lt: now },
        status: {
          in: [
            QuoteStatus.SENT,
            QuoteStatus.IN_DISCUSSION,
            QuoteStatus.IN_NEGOTIATION,
          ],
        },
      },
      select: { id: true },
    });
    if (candidates.length === 0) return;
    await this.prisma.quote.updateMany({
      where: { id: { in: candidates.map((q) => q.id) } },
      data: { status: QuoteStatus.EXPIRED },
    });
  }

  // Lead SLA: unassigned for > 4 hours — notify SALES_MANAGER every hour
  @Cron(CronExpression.EVERY_HOUR)
  async notifyUnassignedLeadSla() {
    const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000);

    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: 'INCOMING',
        assignedToId: null,
        createdAt: { lt: threshold },
      },
      select: { id: true, leadNumber: true },
      take: 50,
    });

    if (leads.length === 0) return;

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
        eventCode: 'lead.unassigned_sla',
        subject: `${leads.length} عميل محتمل بلا تعيين (>4 ساعات)`,
        body: leads.map((l) => l.leadNumber).join('، '),
        deepLink: '/leads',
        payload: { leadIds: leads.map((l) => l.id) },
      },
    );
  }

  // Lead SLA: first contact not made within 24h of assignment — notify SALES_MANAGER every hour
  @Cron(CronExpression.EVERY_HOUR)
  async notifyFirstContactSla() {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: 'ASSIGNED',
        firstResponseAt: null,
        assignedAt: { lt: threshold },
      },
      select: { id: true, leadNumber: true },
      take: 50,
    });

    if (leads.length === 0) return;

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
        eventCode: 'lead.first_contact_sla',
        subject: `${leads.length} عميل محتمل بدون تواصل أولي (>24 ساعة)`,
        body: leads.map((l) => l.leadNumber).join('، '),
        deepLink: '/leads',
        payload: { leadIds: leads.map((l) => l.id) },
      },
    );
  }

  // Tender deadline notifications — daily at 07:00
  @Cron('0 7 * * *')
  async notifyTenderDeadlines() {
    const managers = await this.prisma.user.findMany({
      where: {
        role: {
          in: ['SALES_MANAGER', 'TECHNICAL_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
        },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (managers.length === 0) return;
    const managerIds = managers.map((m) => m.id);

    const checkDays = [7, 3, 1] as const;

    for (const days of checkDays) {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() + days);
      windowStart.setHours(0, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setHours(23, 59, 59, 999);

      const leads = await this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          channel: LeadChannel.GOVERNMENT_TENDER,
          tenderDeadline: { gte: windowStart, lte: windowEnd },
        },
        select: { id: true, leadNumber: true, tenderDeadline: true },
        take: 50,
      });

      if (leads.length === 0) continue;

      void this.notifications.sendToMany(managerIds, {
        eventCode: `lead.tender_deadline_${days}d`,
        subject: `${leads.length} مناقصة تنتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`,
        body: leads.map((l) => l.leadNumber).join('، '),
        deepLink: '/leads',
        payload: { leadIds: leads.map((l) => l.id), daysRemaining: days },
      });
    }
  }

  // Finance: active projects with no invoice in last 30 days — notify FINANCE_MANAGER every hour
  @Cron(CronExpression.EVERY_HOUR)
  async notifyNoRecentInvoice() {
    const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const projects = await this.prisma.project.findMany({
      where: {
        status: 'ACTIVE',
        actualProgress: { gt: 0 },
      },
      select: {
        id: true,
        projectNumber: true,
        invoices: {
          where: { issueDate: { gte: threshold } },
          select: { id: true },
          take: 1,
        },
      },
      take: 100,
    });

    const overdue = projects.filter((p) => p.invoices.length === 0);
    if (overdue.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (managers.length === 0) return;

    void this.notifications.sendToMany(
      managers.map((m) => m.id),
      {
        eventCode: 'finance.no_recent_invoice',
        subject: `${overdue.length} مشروع بدون فاتورة خلال آخر 30 يومًا`,
        body: 'تأخر إصدار فاتورة لمرحلة مكتملة منذ أكثر من 48 ساعة',
        deepLink: '/finance',
        payload: { projectIds: overdue.map((p) => p.id) },
      },
    );
  }

  // Finance: payment validation overdue 24h — notify FINANCE_MANAGER every 2 hours
  @Cron('0 */2 * * *')
  async notifyPaymentValidationOverdue() {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const payments = await this.prisma.payment.findMany({
      where: {
        validationStatus: 'PENDING',
        createdAt: { lt: threshold },
      },
      select: { id: true },
      take: 100,
    });

    if (payments.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (managers.length === 0) return;

    void this.notifications.sendToMany(
      managers.map((m) => m.id),
      {
        eventCode: 'finance.payment_validation_overdue',
        subject: `${payments.length} دفعة بانتظار التحقق منذ أكثر من 24 ساعة`,
        body: 'يوجد دفعات معلقة التحقق تجاوزت مهلة 24 ساعة',
        deepLink: '/finance',
        payload: { paymentIds: payments.map((p) => p.id) },
      },
    );
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

  // BPD: Mark follow-ups as DUE_TODAY at 07:45 (before 08:00 notification crons)
  @Cron('45 7 * * *')
  async markFollowUpsDueToday() {
    const start = startOfToday();
    const end = endOfToday();

    await this.prisma.followUp.updateMany({
      where: {
        status: 'PENDING',
        dueAt: { gte: start, lte: end },
      },
      data: { status: 'DUE_TODAY' },
    });
  }

  // BPD: Alert on quotes with no update for 7+ days (daily at 09:00)
  @Cron('0 9 * * *')
  async notifyStaleOpenQuotes() {
    const staleQuoteDays = await this.readSystemSettingInt(
      'STALE_QUOTE_DAYS',
      7,
    );
    const cutoff = new Date(Date.now() - staleQuoteDays * 24 * 60 * 60 * 1000);

    const quotes = await this.prisma.quote.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SENT', 'IN_DISCUSSION', 'IN_NEGOTIATION'] },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, quoteNumber: true, preparedById: true },
      take: 100,
    });

    if (quotes.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    for (const q of quotes) {
      const recipients = Array.from(
        new Set([...(q.preparedById ? [q.preparedById] : []), ...managerIds]),
      );
      void this.notifications.sendToMany(recipients, {
        eventCode: 'quote.stale_open',
        subject: `عرض سعر مفتوح بدون تحديث: ${q.quoteNumber}`,
        body: `لم يتم تحديث هذا العرض منذ أكثر من ${staleQuoteDays} أيام`,
        deepLink: `/quotes/${q.id}`,
        payload: { quoteId: q.id, quoteNumber: q.quoteNumber },
      });
    }
  }

  // BPD: Weekly target shortfall alert (every Sunday at 08:00)
  @Cron('0 8 * * 0')
  async notifyTargetShortfall() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const daysInMonth = monthEnd.getDate();
    const daysRemaining = daysInMonth - now.getDate();

    if (daysRemaining <= 7) return; // Not worth alerting in the last week

    const targets = await this.prisma.salesTarget.findMany({
      where: {
        period: 'MONTHLY',
        periodStart: { gte: monthStart },
        periodEnd: { lte: monthEnd },
      },
      select: {
        id: true,
        ownerId: true,
        targetValue: true,
        achievedValue: true,
      },
    });

    if (targets.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    for (const target of targets) {
      const ratio =
        target.targetValue > 0 ? target.achievedValue / target.targetValue : 1;
      if (ratio >= 0.5) continue;

      const recipients = Array.from(new Set([target.ownerId, ...managerIds]));
      void this.notifications.sendToMany(recipients, {
        eventCode: 'target.shortfall_warning',
        subject: `تحذير: الهدف الشهري أقل من 50% (${Math.round(ratio * 100)}%)`,
        body: `المحقق: ${target.achievedValue} من ${target.targetValue} — تبقى ${daysRemaining} يوم`,
        deepLink: '/pipeline',
        payload: {
          targetId: target.id,
          ownerId: target.ownerId,
          achievedRatio: ratio,
          daysRemaining,
        },
      });
    }
  }

  // BPD: Financial risk auto-flag (every 6 hours)
  @Cron('0 */6 * * *')
  async checkFinancialRisk() {
    const projects = await this.prisma.project.findMany({
      where: {
        status: { in: ['ACTIVE', 'AT_RISK'] },
      },
      include: {
        po: {
          include: {
            payments: {
              where: { validationStatus: 'VALIDATED' },
              select: { amount: true },
            },
          },
        },
      },
    });

    const financeManagers = await this.prisma.user.findMany({
      where: {
        role: {
          in: ['FINANCE_MANAGER', 'SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
        },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const alertRecipients = financeManagers.map((m) => m.id);

    for (const project of projects) {
      const totalCollected = project.po.payments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const executionValue =
        (project.actualProgress / 100) * project.contractValue;
      const buffer = 0.1 * project.contractValue;

      const atRisk = executionValue > totalCollected + buffer;

      if (atRisk && !project.financialRiskFlagged) {
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            financialRiskFlagged: true,
            financialRiskFlaggedAt: new Date(),
          },
        });
        if (alertRecipients.length > 0) {
          void this.notifications.sendToMany(alertRecipients, {
            eventCode: 'project.financial_risk',
            subject: `خطر مالي: ${project.projectNumber}`,
            body: `التنفيذ (${Math.round(project.actualProgress)}%) يتجاوز المتحصل بأكثر من 10%`,
            deepLink: `/projects/${project.id}`,
            payload: {
              projectId: project.id,
              executionValue,
              totalCollected,
            },
          });
        }
      } else if (!atRisk && project.financialRiskFlagged) {
        // Risk resolved — clear the flag
        await this.prisma.project.update({
          where: { id: project.id },
          data: {
            financialRiskFlagged: false,
            financialRiskFlaggedAt: null,
          },
        });
      }
    }
  }

  // BPD: Visit reminder — notify 1 hour before scheduled visit (runs every hour)
  @Cron(CronExpression.EVERY_HOUR)
  async notifyUpcomingVisits() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 50 * 60 * 1000); // now + 50 min
    const windowEnd = new Date(now.getTime() + 70 * 60 * 1000); // now + 70 min

    const visits = await this.prisma.fieldVisit.findMany({
      where: {
        scheduledAt: { gte: windowStart, lte: windowEnd },
        completedAt: null,
        authorId: { not: null },
      },
      select: { id: true, authorId: true, scheduledAt: true },
      take: 50,
    });

    for (const visit of visits) {
      if (!visit.authorId) continue;
      void this.notifications.send({
        recipientId: visit.authorId,
        eventCode: 'visit.reminder_1h',
        subject: 'تذكير: زيارة ميدانية خلال ساعة',
        body: `موعد الزيارة: ${visit.scheduledAt.toLocaleTimeString('ar-SA')}`,
        deepLink: '/pipeline',
        payload: { visitId: visit.id },
      });
    }
  }

  // BPD: Visit log overdue — notify if scheduled > 3 hours ago and not completed (every 2 hours)
  @Cron('0 */2 * * *')
  async notifyOverdueVisitLogs() {
    const threshold = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

    const visits = await this.prisma.fieldVisit.findMany({
      where: {
        scheduledAt: { lt: threshold },
        completedAt: null,
        authorId: { not: null },
      },
      select: { id: true, authorId: true, scheduledAt: true },
      take: 50,
    });

    if (visits.length === 0) return;

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: ['SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    for (const visit of visits) {
      if (!visit.authorId) continue;
      const recipients = Array.from(new Set([visit.authorId, ...managerIds]));
      void this.notifications.sendToMany(recipients, {
        eventCode: 'visit.log_overdue',
        subject: 'تسجيل زيارة متأخر',
        body: `زيارة لم يتم تسجيلها منذ أكثر من 3 ساعات (${visit.scheduledAt.toLocaleDateString('ar-SA')})`,
        deepLink: '/pipeline',
        payload: { visitId: visit.id },
      });
    }
  }

  private async readSystemSettingInt(
    key: string,
    defaultValue: number,
  ): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) return defaultValue;
    const value = Number(setting.value);
    return Number.isFinite(value) ? value : defaultValue;
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
