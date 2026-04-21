import { Injectable } from '@nestjs/common';
import { NotificationPriority, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SendNotificationInput {
  recipientId: string;
  eventCode: string;
  subject: string;
  body: string;
  locale?: string;
  priority?: NotificationPriority;
  deepLink?: string | null;
  payload?: Prisma.InputJsonValue | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async send(input: SendNotificationInput) {
    try {
      return await this.prisma.notification.create({
        data: {
          recipientId: input.recipientId,
          eventCode: input.eventCode,
          subject: input.subject,
          body: input.body,
          locale: input.locale ?? 'ar',
          priority: input.priority ?? NotificationPriority.NORMAL,
          deepLink: input.deepLink ?? undefined,
          payload:
            input.payload === null
              ? Prisma.JsonNull
              : (input.payload ?? undefined),
        },
      });
    } catch {
      // Best-effort — never let notification failures break business ops.
      return null;
    }
  }

  async sendToMany(
    recipientIds: string[],
    base: Omit<SendNotificationInput, 'recipientId'>,
  ) {
    return Promise.all(
      recipientIds.map((recipientId) => this.send({ ...base, recipientId })),
    );
  }

  list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.recipientId !== userId) return null;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
