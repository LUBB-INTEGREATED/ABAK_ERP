import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PipelineStage,
  Prisma,
  QuoteStatus,
  RfqDeclineType,
  RfqStatus,
} from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { DeclineRfqDto } from './dto/decline-rfq.dto';
import { ListRfqsDto } from './dto/list-rfqs.dto';
import { RerouteRfqDto } from './dto/reroute-rfq.dto';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  /**
   * DM-4: the accept+assign seam. Atomically mints the Draft Quote for an RFQ,
   * one QuoteDepartmentSection per involved category (DM-3), and flips the RFQ
   * to PRICING. Idempotent — a second call (double-click, or a subsequent dept
   * manager) returns the existing quote. `leadId` is null-safe (client-only
   * opportunity). Pricer assignments are written separately via the existing
   * rfq-assignments endpoint (spec §3.4).
   */
  async startPricing(id: string, actorId: string, scopeCtx?: ScopeContext) {
    await this.assertRfqInScope(id, scopeCtx);
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: {
        id: true,
        rfqNumber: true,
        clientId: true,
        quoteId: true,
        status: true,
        requestedCategoryIds: true,
        opportunityId: true,
      },
    });
    if (!rfq) throw new NotFoundException();
    if (
      rfq.status === RfqStatus.DECLINED ||
      rfq.status === RfqStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot price a declined/cancelled RFQ');
    }

    // Idempotent: if already linked, return it (covers double-click + the
    // subsequent dept manager who joins an in-flight quote).
    if (rfq.quoteId) {
      const existing = await this.prisma.quote.findUnique({
        where: { id: rfq.quoteId },
        select: { id: true, quoteNumber: true },
      });
      if (existing)
        return { quoteId: existing.id, quoteNumber: existing.quoteNumber };
    }

    // leadId is canonical on the opportunity (RFQ has no direct leadId);
    // null-safe for a client-only opportunity.
    const opp = await this.prisma.pipelineEntry.findUnique({
      where: { id: rfq.opportunityId },
      select: { leadId: true },
    });
    const categoryIds = rfq.requestedCategoryIds ?? [];

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.quote.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { quoteNumber: true },
      });
      const quoteNumber = nextEntityNumber('QUO', last?.quoteNumber);

      const quote = await tx.quote.create({
        data: {
          quoteNumber,
          clientId: rfq.clientId,
          leadId: opp?.leadId ?? undefined,
          title: `عرض سعر — ${rfq.rfqNumber}`,
          status: QuoteStatus.DRAFT,
          preparedById: actorId,
          // One section per involved Department (DM-3). Pricers add their line
          // items + scope text under their section in the builder.
          departmentSections: categoryIds.length
            ? { create: categoryIds.map((departmentId) => ({ departmentId })) }
            : undefined,
        },
        select: { id: true, quoteNumber: true },
      });

      await tx.rfq.update({
        where: { id },
        data: { quoteId: quote.id, status: RfqStatus.PRICING },
      });

      return { quoteId: quote.id, quoteNumber: quote.quoteNumber };
    });
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

  /**
   * DM-14: un-accept / return-to-triage. A dept manager reverses an accidental
   * accept while the draft quote is still empty: only allowed when the RFQ is
   * PRICING, its quote is still DRAFT, and no line has been priced. Nulls the
   * quoteId (FK must clear before the quote is deleted), deletes the draft (its
   * sections cascade), and returns the RFQ to SUBMITTED.
   */
  async unaccept(id: string, scopeCtx?: ScopeContext) {
    await this.assertRfqInScope(id, scopeCtx);
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: { id: true, quoteId: true, status: true },
    });
    if (!rfq) throw new NotFoundException();
    if (rfq.status !== RfqStatus.PRICING || !rfq.quoteId) {
      throw new BadRequestException(
        'Only an in-pricing RFQ can be returned to triage',
      );
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id: rfq.quoteId },
      select: {
        id: true,
        status: true,
        items: {
          where: { subtotal: { gt: 0 } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (quote && quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot return to triage: the quote is no longer a draft',
      );
    }
    if (quote && quote.items.length > 0) {
      throw new BadRequestException(
        'Cannot return to triage: the quote already has priced items',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.rfq.update({
        where: { id },
        data: { quoteId: null, status: RfqStatus.SUBMITTED },
        include: RFQ_DETAIL_INCLUDE,
      });
      if (quote) await tx.quote.delete({ where: { id: quote.id } });
      return next;
    });
    return { ...updated, displayStatus: deriveRfqDisplayStatus(updated) };
  }

  /**
   * DM-5: decline ("Not us"). A dept manager rejects an RFQ before pricing with
   * a required reason. WRONG_DEPT routes back to sales for re-route (DM-6);
   * NO_BID closes it out. Notifies the originating sales rep + creator.
   */
  async declineRfq(
    id: string,
    dto: DeclineRfqDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.assertRfqInScope(id, scopeCtx);
    const rfq = await this.requireStatus(id, [
      RfqStatus.SUBMITTED,
      RfqStatus.ASSIGNED,
    ]);
    if (rfq.quoteId) {
      throw new BadRequestException('Cannot decline after pricing started');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // RV-2: a wrong-dept decline must strip the RFQ's assignment rows so the
      // wrong department's manager + engineer lose scope/visibility once it is
      // re-routed elsewhere (assignments are the DEPARTMENT-scope predicate).
      if (dto.type === RfqDeclineType.WRONG_DEPT) {
        await tx.rfqAssignment.deleteMany({ where: { rfqId: id } });
      }
      return tx.rfq.update({
        where: { id },
        data: {
          status: RfqStatus.DECLINED,
          declineType: dto.type,
          declineReason: dto.reason,
          declinedById: actorId,
          declinedAt: new Date(),
        },
        include: RFQ_DETAIL_INCLUDE,
      });
    });

    const recipients = [
      ...new Set(
        [updated.originalSalesRepId, updated.createdBy].filter(
          (r): r is string => Boolean(r),
        ),
      ),
    ];
    if (recipients.length) {
      void this.notifications.sendToMany(recipients, {
        eventCode:
          dto.type === RfqDeclineType.NO_BID
            ? 'rfq.declined_no_bid'
            : 'rfq.declined_wrong_dept',
        subject: `تم رفض طلب التسعير: ${updated.rfqNumber}`,
        body:
          dto.type === RfqDeclineType.NO_BID
            ? `لن يتم التقديم — السبب: ${dto.reason}`
            : `القسم غير مختص — يحتاج إعادة توجيه — السبب: ${dto.reason}`,
        deepLink: `/rfqs/${id}`,
        payload: {
          rfqId: id,
          rfqNumber: updated.rfqNumber,
          declineType: dto.type,
        },
      });
    }
    return { ...updated, displayStatus: deriveRfqDisplayStatus(updated) };
  }

  /**
   * DM-6: re-route a wrong-department decline back into triage. Sales picks new
   * categories; the decline audit is cleared, status returns to SUBMITTED, and
   * the department inbox routing is re-fired for the new categories.
   */
  async reroute(id: string, dto: RerouteRfqDto, scopeCtx?: ScopeContext) {
    await this.assertRfqInScope(id, scopeCtx);
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: { id: true, status: true, declineType: true },
    });
    if (!rfq) throw new NotFoundException();
    if (
      rfq.status !== RfqStatus.DECLINED ||
      rfq.declineType !== RfqDeclineType.WRONG_DEPT
    ) {
      throw new BadRequestException(
        'Re-route is only allowed for a wrong-department decline',
      );
    }

    const updated = await this.prisma.rfq.update({
      where: { id },
      data: {
        requestedCategoryIds: dto.requestedCategoryIds,
        status: RfqStatus.SUBMITTED,
        declineType: null,
        declineReason: null,
        declinedById: null,
        declinedAt: null,
      },
      include: RFQ_DETAIL_INCLUDE,
    });

    void this.routeToManagers(
      updated.id,
      updated.rfqNumber,
      dto.requestedCategoryIds,
    );
    return { ...updated, displayStatus: deriveRfqDisplayStatus(updated) };
  }

  /**
   * Best-effort department-inbox routing: notify the managers of the
   * departments offering the given categories (ServiceCategory →
   * DepartmentService → managerId). Never blocks the caller.
   */
  private async routeToManagers(
    rfqId: string,
    rfqNumber: string,
    categoryIds: string[],
  ): Promise<void> {
    if (!categoryIds.length) return;
    try {
      const links = await this.prisma.departmentService.findMany({
        where: { serviceCategoryId: { in: categoryIds } },
        select: { department: { select: { managerId: true } } },
      });
      const managerIds = [
        ...new Set(
          links
            .map((l) => l.department.managerId)
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      if (managerIds.length) {
        await this.notifications.sendToMany(managerIds, {
          eventCode: 'rfq.received',
          subject: `طلب تسعير مُعاد توجيهه بانتظار التعيين: ${rfqNumber}`,
          body: `تمت إعادة توجيه الطلب ${rfqNumber} إلى قسمكم.`,
          deepLink: `/rfqs/${rfqId}`,
          payload: { rfqId, rfqNumber, rerouted: true },
        });
      }
    } catch {
      // best-effort routing; never block the re-route
    }
  }

  private async requireStatus(id: string, allowed: RfqStatus[]) {
    const rfq = await this.prisma.rfq.findUnique({ where: { id } });
    if (!rfq) throw new NotFoundException();
    if (!allowed.includes(rfq.status)) {
      throw new BadRequestException(
        `Action not allowed in current status ${rfq.status}`,
      );
    }
    return rfq;
  }

  private async generateRfqNumber(): Promise<string> {
    const last = await this.prisma.rfq.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { rfqNumber: true },
    });
    return nextEntityNumber('RFQ', last?.rfqNumber);
  }
}
