import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PipelineStage, Prisma, RfqStatus } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignContributorDto,
  ContributorRole,
} from './dto/assign-contributor.dto';
import { AssignCoordinatorDto } from './dto/assign-coordinator.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { DispatchRfqDto } from './dto/dispatch-rfq.dto';
import { ListRfqsDto } from './dto/list-rfqs.dto';
import { RfqOutcomeDto, RfqOutcomeValue } from './dto/rfq-outcome.dto';
import { rfqScopeFilter, type ScopeContext } from '../auth/scope.util';

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
        status: RfqStatus.RECEIVED,
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
    // (assigned to any member of the department); engineers see RFQs assigned to
    // them; Sales Reps see RFQs they originated; ALL viewers are unrestricted.
    const managedRfqDeptId =
      scopeCtx?.scope === 'DEPARTMENT'
        ? scopeCtx.user.managedDepartment?.id
        : undefined;
    if (managedRfqDeptId) {
      const members = await this.prisma.user.findMany({
        where: { departmentId: managedRfqDeptId },
        select: { id: true },
      });
      where.AND = [
        {
          assignments: {
            some: { assigneeId: { in: members.map((m) => m.id) } },
          },
        },
      ];
    } else {
      const rfqScope = rfqScopeFilter(scopeCtx);
      if (Object.keys(rfqScope).length) {
        where.AND = [rfqScope as Prisma.RfqWhereInput];
      }
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
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      include: RFQ_DETAIL_INCLUDE,
    });
    if (!rfq) throw new NotFoundException();
    return rfq;
  }

  async assignCoordinator(id: string, dto: AssignCoordinatorDto) {
    const rfq = await this.requireStatus(id, [
      RfqStatus.RECEIVED,
      RfqStatus.ASSIGNED,
    ]);
    const coordinator = await this.prisma.user.findUnique({
      where: { id: dto.coordinatorId },
    });
    if (!coordinator) throw new NotFoundException('Coordinator not found');
    return this.prisma.rfq.update({
      where: { id: rfq.id },
      data: {
        coordinatorId: dto.coordinatorId,
        coordinatorAssignedAt: new Date(),
        status: RfqStatus.ASSIGNED,
      },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async assignContributor(id: string, dto: AssignContributorDto) {
    const rfq = await this.requireStatus(id, [
      RfqStatus.ASSIGNED,
      RfqStatus.IN_PREPARATION,
    ]);
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');
    const data: Prisma.RfqUpdateInput =
      dto.role === ContributorRole.TECHNICAL
        ? { technicalContributor: { connect: { id: dto.userId } } }
        : { financialReviewer: { connect: { id: dto.userId } } };
    return this.prisma.rfq.update({
      where: { id: rfq.id },
      data,
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async startPreparation(id: string) {
    const rfq = await this.requireStatus(id, [RfqStatus.ASSIGNED]);
    if (!rfq.coordinatorId) {
      throw new BadRequestException('Coordinator must be assigned first');
    }
    return this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: RfqStatus.IN_PREPARATION },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async submitForApproval(id: string) {
    const rfq = await this.requireStatus(id, [RfqStatus.IN_PREPARATION]);
    if (!rfq.quoteId) {
      throw new BadRequestException(
        'A linked Quote with items is required before submitting for approval (BR-06).',
      );
    }
    const quote = await this.prisma.quote.findUnique({
      where: { id: rfq.quoteId },
      include: { items: true, paymentMilestones: true },
    });
    if (!quote) {
      throw new BadRequestException('Linked Quote not found');
    }
    if (quote.items.length === 0) {
      throw new BadRequestException(
        'Linked Quote has no items; cannot submit for approval.',
      );
    }
    if (quote.paymentMilestones.length === 0) {
      throw new BadRequestException(
        'Linked Quote has no payment milestones; cannot submit for approval.',
      );
    }
    return this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: RfqStatus.PENDING_APPROVAL },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async markApproved(id: string) {
    const rfq = await this.requireStatus(id, [RfqStatus.PENDING_APPROVAL]);
    return this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: RfqStatus.APPROVED_READY_FOR_DISPATCH },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async dispatch(id: string, dto: DispatchRfqDto) {
    const rfq = await this.requireStatus(id, [
      RfqStatus.APPROVED_READY_FOR_DISPATCH,
    ]);
    return this.prisma.rfq.update({
      where: { id: rfq.id },
      data: {
        status: RfqStatus.SENT,
        dispatchedAt: new Date(),
        dispatchedVia: dto.channel,
      },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async recordOutcome(id: string, dto: RfqOutcomeDto) {
    const rfq = await this.requireStatus(id, [RfqStatus.SENT]);
    const base: Prisma.RfqUpdateInput = {};

    switch (dto.outcome) {
      case RfqOutcomeValue.WON:
        base.status = RfqStatus.WON;
        base.confirmationType = dto.confirmationType;
        base.confirmationValue = dto.confirmationValue;
        base.confirmationAt = dto.confirmationAt
          ? new Date(dto.confirmationAt)
          : null;
        base.confirmationDocUrl = dto.confirmationDocUrl;
        break;
      case RfqOutcomeValue.LOST:
        base.status = RfqStatus.LOST;
        base.lostReason = dto.lostReason;
        break;
      case RfqOutcomeValue.POSTPONED:
        base.status = RfqStatus.POSTPONED;
        base.postponedUntil = dto.postponedUntil
          ? new Date(dto.postponedUntil)
          : null;
        break;
    }

    const updated = await this.prisma.rfq.update({
      where: { id: rfq.id },
      data: base,
      include: RFQ_DETAIL_INCLUDE,
    });

    // M7-005: auto-accrue commission when RFQ is WON and has broker info.
    if (dto.outcome === RfqOutcomeValue.WON && rfq.brokerName) {
      const rateSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'commission_rate_broker_default' },
      });
      const rate = rateSetting ? Number(rateSetting.value) : 3;
      await this.prisma.commission.create({
        data: {
          rfqId: rfq.id,
          beneficiaryType: 'BROKER',
          beneficiaryName: rfq.brokerName,
          beneficiaryPhone: rfq.brokerPhone,
          baseAmount: 0, // grows as validated payments come in
          rate,
          amount: 0,
          status: 'ACCRUING',
          notes: `Auto-accrued on RFQ ${rfq.rfqNumber} WON.`,
        },
      });
    }

    return updated;
  }

  async linkQuote(id: string, quoteId: string) {
    const rfq = await this.findOne(id);
    if (rfq.quoteId && rfq.quoteId !== quoteId) {
      throw new BadRequestException(
        'RFQ is already linked to a different quote',
      );
    }
    return this.prisma.rfq.update({
      where: { id },
      data: { quoteId },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async cancel(id: string) {
    const rfq = await this.findOne(id);
    if (
      [RfqStatus.WON, RfqStatus.LOST, RfqStatus.CANCELLED].includes(rfq.status)
    ) {
      throw new ForbiddenException('Cannot cancel a terminal RFQ');
    }
    return this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.CANCELLED },
      include: RFQ_DETAIL_INCLUDE,
    });
  }

  async stats() {
    const [total, byStatus, slaBreachCount] = await this.prisma.$transaction([
      this.prisma.rfq.count(),
      this.prisma.rfq.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.rfq.count({
        where: {
          status: RfqStatus.RECEIVED,
          createdAt: { lt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return {
      total,
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      coordinatorSlaBreached: slaBreachCount,
    };
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
