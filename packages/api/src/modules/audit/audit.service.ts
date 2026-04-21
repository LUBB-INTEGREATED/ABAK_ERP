import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditRecord {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Prisma.InputJsonValue | null;
  newValues?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(record: AuditRecord): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: record.userId ?? undefined,
          action: record.action,
          entity: record.entity,
          entityId: record.entityId,
          oldValues:
            record.oldValues === null
              ? Prisma.JsonNull
              : (record.oldValues ?? undefined),
          newValues:
            record.newValues === null
              ? Prisma.JsonNull
              : (record.newValues ?? undefined),
          ipAddress: record.ipAddress ?? undefined,
          userAgent: record.userAgent ?? undefined,
        },
      });
    } catch {
      // Best-effort: never let audit failures break business operations.
    }
  }

  list(filter: {
    userId?: string;
    entity?: string;
    entityId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 50;

    const where: Prisma.AuditLogWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.entity ? { entity: filter.entity } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };

    return this.prisma
      .$transaction([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ])
      .then(([total, data]) => ({
        data,
        pagination: {
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
        },
      }));
  }

  listForEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
