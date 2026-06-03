import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PipelineStage, Prisma, RfqStatus } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { ListRfqsDto } from './dto/list-rfqs.dto';
import {
  isUnrestricted,
  rfqScopeFilter,
  type ScopeContext,
} from '../auth/scope.util';
import { deriveRfqDisplayStatus } from './rfq-display-status';

const RFQ_DETAIL_INCLUDE = {
  client: true,
  opportunity: { include: { lead: true } },
  coordinator: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  technicalContributor: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  financialReviewer: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  originalSalesRep: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  quote: {
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      totalAmount: true,
      version: true,
      sentAt: true,
    },
  },
} satisfies Prisma.RfqInclude;

@Injectable()
export class RfqsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRfqDto, actorId: string) {
    const opportunity = await this.prisma.pipelineEntry.findUnique({
      where: { id: dto.opportunityId },
      include: { lead: true, rfq: true },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    if (opportunity.rfq)
      throw new BadRequestException(
        'An RFQ already exists for this opportunity',
      );
    if (opportunity.stage !== PipelineStage.READY_FOR_RFQ) {
      throw new BadRequestException(
        'Opportunity must be READY_FOR_RFQ to create an RFQ (BR-05).',
      );
    }
    if (!opportunity.clientId && !opportunity.leadId) {
      throw new BadRequestException(
        'Opportunity must have a client or lead before creating an RFQ.',
      );
    }

    const clientId = opportunity.clientId ?? opportunity.lead?.clientId ?? null;
    if (!clientId) {
      throw new BadRequestException(
        'Cannot create RFQ: opportunity lead is not linked to a client yet.',
      );
    }

    const rfqNumber = await this.generateRfqNumber();

    return this.prisma.rfq.create({
      data: {
        rfqNumber,
        opportunityId: opportunity.id,
        clientId,
        serviceType: dto.serviceType,
        projectScope: dto.projectScope,
        priority: dto.priority ?? 'NORMAL',
        requestedByChannel: dto.requestedByChannel,
        brokerName: dto.brokerName,
        brokerPhone: dto.brokerPhone,
        originalSalesRepId: opportunity.ownerId,
        // DM-1: thin RFQ starts at SUBMITTED (was RECEIVED).
        status: RfqStatus.SUBMITTED,
        createdBy: actorId,
      },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async list(query: ListRfqsDto, scopeCtx?: ScopeContext) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.RfqWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.coordinatorId ? { coordinatorId: query.coordinatorId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.source ? { requestedByChannel: query.source } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search
        ? {
            OR: [
              { rfqNumber: { contains: query.search, mode: 'insensitive' } },
              { serviceType: { contains: query.search, mode: 'insensitive' } },
              {
                client: {
                  contactName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                client: {
                  companyName: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    // Row-level scope: department managers see their whole department's RFQs
    // (assigned to a member OR routed to one of the department's service
    // categories but not yet assigned — D1); engineers see RFQs assigned to
    // them; Sales Reps see RFQs they originated or raised; ALL is unrestricted.
    const scopeWhere = await this.rfqScopeWhere(scopeCtx);
    if (scopeWhere) {
      where.AND = [scopeWhere];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.rfq.count({ where }),
      this.prisma.rfq.findMany({
        where,
        include: {
          client: {
            select: { id: true, contactName: true, companyName: true },
          },
          coordinator: {
            select: { id: true, firstName: true, lastName: true },
          },
          // DM-2: the Quote status is the source of truth for the derived
          // sales-facing display status.
          quote: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: data.map((rfq) => ({
        ...rfq,
        displayStatus: deriveRfqDisplayStatus(rfq),
      })),
      pagination: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string, scopeCtx?: ScopeContext) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      include: RFQ_DETAIL_INCLUDE,
    });
    if (!rfq) throw new NotFoundException();
    // Object-level scope: re-check the same scope predicate the list uses so a
    // non-ALL actor can't read an RFQ outside their scope by id (cross-rep IDOR).
    await this.assertRfqInScope(id, scopeCtx);
    return { ...rfq, displayStatus: deriveRfqDisplayStatus(rfq) };
  }

  /**
   * Build the row-level scope `where` fragment for the current viewer, or null
   * when unrestricted (ALL). Single source of truth shared by list() and the
   * object-level guard so detail-read matches list visibility exactly.
   *
   * - DEPARTMENT manager: RFQs assigned to a department member, OR routed to a
   *   ServiceCategory the department offers (requestedCategoryIds) — the latter
   *   makes a freshly-raised, still-unassigned RFQ visible to the manager who
   *   must assign pricers (D1).
   * - DEPARTMENT engineer (no managed dept): RFQs assigned to them.
   * - OWN (Sales Rep): RFQs they originated or raised.
   */
  private async rfqScopeWhere(
    scopeCtx?: ScopeContext,
  ): Promise<Prisma.RfqWhereInput | null> {
    if (isUnrestricted(scopeCtx)) return null;
    const managedDeptId =
      scopeCtx!.scope === 'DEPARTMENT'
        ? scopeCtx!.user.managedDepartment?.id
        : undefined;
    if (managedDeptId) {
      const [members, links] = await Promise.all([
        this.prisma.user.findMany({
          where: { departmentId: managedDeptId },
          select: { id: true },
        }),
        this.prisma.departmentService.findMany({
          where: { departmentId: managedDeptId },
          select: { serviceCategoryId: true },
        }),
      ]);
      const memberIds = members.map((m) => m.id);
      const catIds = links.map((l) => l.serviceCategoryId);
      const or: Prisma.RfqWhereInput[] = [
        { assignments: { some: { assigneeId: { in: memberIds } } } },
      ];
      if (catIds.length) {
        or.push({ requestedCategoryIds: { hasSome: catIds } });
      }
      return { OR: or };
    }
    // OWN, or a DEPARTMENT engineer without a managed department.
    const filter = rfqScopeFilter(scopeCtx);
    return Object.keys(filter).length ? (filter as Prisma.RfqWhereInput) : null;
  }

  private async assertRfqInScope(id: string, scopeCtx?: ScopeContext) {
    const scopeWhere = await this.rfqScopeWhere(scopeCtx);
    if (!scopeWhere) return;
    const visible = await this.prisma.rfq.findFirst({
      where: { id, ...scopeWhere },
      select: { id: true },
    });
    if (!visible) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }

  /**
   * Public guard reused by the RFQ sub-resources (assignments / doc-requests /
   * site-visit-requests): the RFQ must exist (404) AND be in the actor's scope
   * (403). Replaces a bare existence check so child collections can't bypass the
   * parent-RFQ scope.
   */
  async assertCanAccess(rfqId: string, scopeCtx?: ScopeContext): Promise<void> {
    const exists = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('RFQ not found');
    await this.assertRfqInScope(rfqId, scopeCtx);
  }

  async cancel(id: string, scopeCtx?: ScopeContext) {
    const rfq = await this.findOne(id, scopeCtx);
    // DM-1: terminal intake states are CANCELLED/DECLINED (won/lost/etc. now
    // live on the Quote and are read via the derived display status).
    if (
      ([RfqStatus.CANCELLED, RfqStatus.DECLINED] as RfqStatus[]).includes(
        rfq.status,
      )
    ) {
      throw new ForbiddenException('Cannot cancel a terminal RFQ');
    }
    const updated = await this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.CANCELLED },
      include: RFQ_DETAIL_INCLUDE,
    });
    return { ...updated, displayStatus: deriveRfqDisplayStatus(updated) };
  }

  async stats() {
    const [total, byStatus, slaBreachCount] = await this.prisma.$transaction([
      this.prisma.rfq.count(),
      this.prisma.rfq.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.rfq.count({
        where: {
          status: RfqStatus.SUBMITTED,
          createdAt: { lt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return {
      total,
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: (row._count as { _all: number })._all,
      })),
      coordinatorSlaBreached: slaBreachCount,
    };
  }

  private async generateRfqNumber(): Promise<string> {
    const last = await this.prisma.rfq.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { rfqNumber: true },
    });
    return nextEntityNumber('RFQ', last?.rfqNumber);
  }
}
