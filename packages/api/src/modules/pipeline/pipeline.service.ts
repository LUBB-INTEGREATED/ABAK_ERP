import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PipelineStage, Prisma, LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateFieldVisitDto,
  CreatePipelineEntryDto,
  CreateTargetDto,
  MoveStageDto,
  PipelineFilterDto,
  UpdateFieldVisitDto,
  UpdatePipelineEntryDto,
} from './dto';

const OPEN_STAGES: PipelineStage[] = [
  PipelineStage.NEW_LEAD,
  PipelineStage.INITIAL_CONTACT,
  PipelineStage.QUALIFICATION,
  PipelineStage.READY_FOR_RFQ,
  PipelineStage.RFQ_RECEIVED,
  PipelineStage.QUOTE_SENT,
  PipelineStage.NEGOTIATION,
];

const CLOSED_STAGES: PipelineStage[] = [
  PipelineStage.WON,
  PipelineStage.LOST,
  PipelineStage.POSTPONED,
];

const STAGE_ORDER: PipelineStage[] = [
  PipelineStage.NEW_LEAD,
  PipelineStage.INITIAL_CONTACT,
  PipelineStage.QUALIFICATION,
  PipelineStage.READY_FOR_RFQ,
  PipelineStage.RFQ_RECEIVED,
  PipelineStage.QUOTE_SENT,
  PipelineStage.NEGOTIATION,
  PipelineStage.WON,
  PipelineStage.LOST,
  PipelineStage.POSTPONED,
];

const ENTRY_INCLUDE = {
  lead: {
    select: {
      id: true,
      leadNumber: true,
      contactName: true,
      companyName: true,
      channel: true,
    },
  },
  client: {
    select: {
      id: true,
      clientNumber: true,
      contactName: true,
      companyName: true,
    },
  },
  owner: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} satisfies Prisma.PipelineEntryInclude;

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(dto: CreatePipelineEntryDto) {
    if (!dto.leadId && !dto.clientId) {
      throw new BadRequestException('leadId or clientId is required');
    }

    if (dto.leadId) {
      const existing = await this.prisma.pipelineEntry.findUnique({
        where: { leadId: dto.leadId },
      });
      if (existing) {
        throw new ConflictException('This lead is already in the pipeline');
      }
    }

    return this.prisma.pipelineEntry.create({
      data: {
        stage: dto.stage ?? PipelineStage.NEW_LEAD,
        leadId: dto.leadId,
        clientId: dto.clientId,
        ownerId: dto.ownerId,
        estimatedValue: dto.estimatedValue,
        probability: dto.probability,
        nextStep: dto.nextStep,
        expectedCloseAt: dto.expectedCloseAt
          ? new Date(dto.expectedCloseAt)
          : undefined,
      },
      include: ENTRY_INCLUDE,
    });
  }

  async listEntries(filter: PipelineFilterDto) {
    const where: Prisma.PipelineEntryWhereInput = {};
    if (filter.stage) where.stage = filter.stage;
    if (filter.ownerId) where.ownerId = filter.ownerId;
    if (filter.search) {
      const search = filter.search.trim();
      where.OR = [
        { lead: { leadNumber: { contains: search, mode: 'insensitive' } } },
        { lead: { contactName: { contains: search, mode: 'insensitive' } } },
        { client: { clientNumber: { contains: search, mode: 'insensitive' } } },
        { client: { contactName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 100;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.pipelineEntry.count({ where }),
      this.prisma.pipelineEntry.findMany({
        where,
        orderBy: [{ stage: 'asc' }, { stageEnteredAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: ENTRY_INCLUDE,
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string) {
    const entry = await this.prisma.pipelineEntry.findUnique({
      where: { id },
      include: {
        ...ENTRY_INCLUDE,
        transitions: {
          orderBy: { occurredAt: 'desc' },
          include: {
            actor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!entry) throw new NotFoundException(`Pipeline entry ${id} not found`);
    return entry;
  }

  async updateEntry(id: string, dto: UpdatePipelineEntryDto) {
    await this.findOne(id);
    const { leadId: _l, clientId: _c, stage: _s, ...rest } = dto;
    const data: Prisma.PipelineEntryUpdateInput = { ...rest };
    if (dto.expectedCloseAt) {
      data.expectedCloseAt = new Date(dto.expectedCloseAt);
    }
    if (dto.ownerId !== undefined) {
      data.owner = dto.ownerId
        ? { connect: { id: dto.ownerId } }
        : { disconnect: true };
    }
    return this.prisma.pipelineEntry.update({
      where: { id },
      data,
      include: ENTRY_INCLUDE,
    });
  }

  async moveStage(id: string, dto: MoveStageDto, actorId?: string) {
    const entry = await this.findOne(id);
    if (entry.stage === dto.stage) {
      return entry;
    }

    if (dto.stage === PipelineStage.LOST && !dto.reason?.trim()) {
      throw new BadRequestException('Reason is required for LOST');
    }
    if (dto.stage === PipelineStage.POSTPONED && !dto.postponedUntil) {
      throw new BadRequestException('postponedUntil is required for POSTPONED');
    }

    const duration = Math.floor(
      (Date.now() - entry.stageEnteredAt.getTime()) / 1000,
    );

    return this.prisma.$transaction(async (tx) => {
      const transition = await tx.stageTransition.create({
        data: {
          pipelineEntryId: entry.id,
          fromStage: entry.stage,
          toStage: dto.stage,
          reason: dto.reason,
          actorId,
          durationSeconds: duration,
        },
      });

      const updateData: Prisma.PipelineEntryUpdateInput = {
        stage: dto.stage,
        stageEnteredAt: new Date(),
      };
      if (CLOSED_STAGES.includes(dto.stage)) {
        updateData.closedAt = new Date();
      }
      if (dto.stage === PipelineStage.LOST) {
        updateData.lostReason = dto.reason;
      }
      if (dto.stage === PipelineStage.POSTPONED && dto.postponedUntil) {
        updateData.postponedUntil = new Date(dto.postponedUntil);
      }
      if (dto.stage === PipelineStage.READY_FOR_RFQ) {
        updateData.readyForRfqAt = new Date();
      }

      const updated = await tx.pipelineEntry.update({
        where: { id: entry.id },
        data: updateData,
        include: ENTRY_INCLUDE,
      });

      if (entry.leadId) {
        const mapping = this.mapStageToLeadStatus(dto.stage);
        if (mapping) {
          await tx.lead.update({
            where: { id: entry.leadId },
            data: {
              status: mapping,
              ...(CLOSED_STAGES.includes(dto.stage)
                ? { closedAt: new Date() }
                : {}),
              ...(dto.stage === PipelineStage.LOST
                ? { lostReason: dto.reason }
                : {}),
            },
          });
        }
      }

      return { entry: updated, transition };
    });
  }

  async deleteEntry(id: string) {
    await this.findOne(id);
    return this.prisma.pipelineEntry.delete({ where: { id } });
  }

  async stats() {
    const [byStage, openAgg, wonAgg, closedCount] = await Promise.all([
      this.prisma.pipelineEntry.groupBy({
        by: ['stage'],
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      this.prisma.pipelineEntry.aggregate({
        where: { stage: { in: OPEN_STAGES } },
        _sum: { estimatedValue: true },
        _count: { _all: true },
      }),
      this.prisma.pipelineEntry.aggregate({
        where: { stage: PipelineStage.WON },
        _sum: { estimatedValue: true },
        _count: { _all: true },
      }),
      this.prisma.pipelineEntry.count({
        where: { stage: { in: CLOSED_STAGES } },
      }),
    ]);

    const wonCount = wonAgg._count._all;
    const conversionRate = closedCount > 0 ? wonCount / closedCount : 0;

    const stageMap = new Map<
      PipelineStage,
      { count: number; estimatedValue: number }
    >();
    for (const row of byStage) {
      stageMap.set(row.stage, {
        count: row._count._all,
        estimatedValue: row._sum.estimatedValue ?? 0,
      });
    }

    return {
      stages: STAGE_ORDER.map((stage) => ({
        stage,
        count: stageMap.get(stage)?.count ?? 0,
        estimatedValue: stageMap.get(stage)?.estimatedValue ?? 0,
      })),
      totals: {
        openCount: openAgg._count._all,
        openEstimatedValue: openAgg._sum.estimatedValue ?? 0,
        wonCount,
        wonValue: wonAgg._sum.estimatedValue ?? 0,
        closedCount,
        conversionRate,
      },
    };
  }

  // Field visits -------------------------------------------------

  async createVisit(dto: CreateFieldVisitDto, actorId?: string) {
    return this.prisma.fieldVisit.create({
      data: {
        visitType: dto.visitType,
        purpose: dto.purpose,
        scheduledAt: new Date(dto.scheduledAt),
        clientId: dto.clientId,
        locationLabel: dto.locationLabel,
        latitude: dto.latitude,
        longitude: dto.longitude,
        attendees: dto.attendees,
        authorId: actorId,
      },
    });
  }

  listVisits(ownerId?: string) {
    return this.prisma.fieldVisit.findMany({
      where: ownerId ? { authorId: ownerId } : undefined,
      orderBy: { scheduledAt: 'desc' },
      include: {
        client: {
          select: { id: true, clientNumber: true, contactName: true },
        },
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async updateVisit(id: string, dto: UpdateFieldVisitDto) {
    const visit = await this.prisma.fieldVisit.findUnique({ where: { id } });
    if (!visit) throw new NotFoundException(`Visit ${id} not found`);
    return this.prisma.fieldVisit.update({
      where: { id },
      data: {
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
        findings: dto.findings,
        nextAction: dto.nextAction,
      },
    });
  }

  // Targets ------------------------------------------------------

  async createTarget(dto: CreateTargetDto) {
    return this.prisma.salesTarget.upsert({
      where: {
        ownerId_type_period_periodStart: {
          ownerId: dto.ownerId,
          type: dto.type,
          period: dto.period,
          periodStart: new Date(dto.periodStart),
        },
      },
      update: {
        targetValue: dto.targetValue,
        periodEnd: new Date(dto.periodEnd),
      },
      create: {
        ownerId: dto.ownerId,
        type: dto.type,
        period: dto.period,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        targetValue: dto.targetValue,
      },
    });
  }

  listTargets(ownerId?: string) {
    return this.prisma.salesTarget.findMany({
      where: ownerId ? { ownerId } : undefined,
      orderBy: [{ periodStart: 'desc' }, { type: 'asc' }],
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  private mapStageToLeadStatus(stage: PipelineStage): LeadStatus | null {
    switch (stage) {
      case PipelineStage.INITIAL_CONTACT:
      case PipelineStage.QUALIFICATION:
        return LeadStatus.CONTACTED;
      case PipelineStage.RFQ_RECEIVED:
      case PipelineStage.QUOTE_SENT:
      case PipelineStage.NEGOTIATION:
        return LeadStatus.QUALIFIED;
      case PipelineStage.WON:
        return LeadStatus.CONVERTED;
      case PipelineStage.LOST:
        return LeadStatus.LOST;
      default:
        return null;
    }
  }
}
