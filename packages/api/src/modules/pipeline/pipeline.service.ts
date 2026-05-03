import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PipelineStage, Prisma, LeadStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  PipelineStage.FIRST_CONTACT_MADE,
  PipelineStage.MEETING_SCHEDULED,
  PipelineStage.MEETING_DONE,
  PipelineStage.READY_FOR_RFQ,
  PipelineStage.RFQ_SUBMITTED,
  PipelineStage.QUOTE_IN_PREPARATION,
  PipelineStage.QUOTE_SENT_TO_CLIENT,
  PipelineStage.NEGOTIATION_REVISION,
];

const CLOSED_STAGES: PipelineStage[] = [
  PipelineStage.WON,
  PipelineStage.LOST,
  PipelineStage.POSTPONED,
];

const STAGE_ORDER: PipelineStage[] = [
  PipelineStage.NEW_LEAD,
  PipelineStage.FIRST_CONTACT_MADE,
  PipelineStage.MEETING_SCHEDULED,
  PipelineStage.MEETING_DONE,
  PipelineStage.READY_FOR_RFQ,
  PipelineStage.RFQ_SUBMITTED,
  PipelineStage.QUOTE_IN_PREPARATION,
  PipelineStage.QUOTE_SENT_TO_CLIENT,
  PipelineStage.NEGOTIATION_REVISION,
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

// Stages that are considered "stuck" after this many days without movement
const STUCK_DAYS_THRESHOLD = 14;

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
        nextStepDueDate: dto.nextStepDueDate
          ? new Date(dto.nextStepDueDate)
          : undefined,
        decisionMakerName: dto.decisionMakerName,
        decisionMakerContact: dto.decisionMakerContact,
        expectedDecisionDate: dto.expectedDecisionDate
          ? new Date(dto.expectedDecisionDate)
          : undefined,
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

    // M3-008 — READY_FOR_RFQ qualification gate (5 criteria)
    if (dto.stage === PipelineStage.READY_FOR_RFQ) {
      const missing: string[] = [];
      if (!entry.nextStep && !dto.nextStep) missing.push('nextStep');
      if (!entry.decisionMakerName && !dto.decisionMakerName)
        missing.push('decisionMakerName');
      if (!entry.expectedDecisionDate && !dto.expectedDecisionDate)
        missing.push('expectedDecisionDate');
      if (!entry.estimatedValue) missing.push('estimatedValue');
      if (!entry.expectedCloseAt) missing.push('expectedCloseAt');
      if (missing.length > 0) {
        throw new BadRequestException(
          `Cannot qualify for RFQ — missing fields: ${missing.join(', ')}`,
        );
      }
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
        // Any stage move clears the stuck flag
        isStuck: false,
        stuckSince: null,
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
      if (dto.nextStep !== undefined) updateData.nextStep = dto.nextStep;
      if (dto.nextStepDueDate !== undefined)
        updateData.nextStepDueDate = new Date(dto.nextStepDueDate);
      if (dto.decisionMakerName !== undefined)
        updateData.decisionMakerName = dto.decisionMakerName;
      if (dto.decisionMakerContact !== undefined)
        updateData.decisionMakerContact = dto.decisionMakerContact;
      if (dto.expectedDecisionDate !== undefined)
        updateData.expectedDecisionDate = new Date(dto.expectedDecisionDate);

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
    const visit = await this.prisma.fieldVisit.create({
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
        keyOutcomes: dto.keyOutcomes,
        clientSentiment: dto.clientSentiment,
        attachmentUrls: dto.attachmentUrls ?? [],
      },
    });

    // M3-009 — field visit auto-creates a matching Interaction in CRM
    if (dto.clientId && actorId) {
      void this.prisma.interaction
        .create({
          data: {
            clientId: dto.clientId,
            type: 'MEETING',
            subject: `زيارة ميدانية: ${dto.purpose}`,
            outcome: 'متابعة مطلوبة',
            nextAction: dto.purpose,
            occurredAt: new Date(dto.scheduledAt),
            authorId: actorId,
          },
        })
        .catch(() => null);
    }

    return visit;
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
        keyOutcomes: dto.keyOutcomes,
        clientSentiment: dto.clientSentiment,
        attachmentUrls: dto.attachmentUrls,
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

  // M3-007 — flag pipeline entries that haven't moved in STUCK_DAYS_THRESHOLD days.
  @Cron('0 7 * * *')
  async flagStuckLeads() {
    const threshold = new Date(
      Date.now() - STUCK_DAYS_THRESHOLD * 24 * 60 * 60 * 1000,
    );

    const stuck = await this.prisma.pipelineEntry.findMany({
      where: {
        stage: { in: OPEN_STAGES },
        isStuck: false,
        stageEnteredAt: { lt: threshold },
      },
      select: { id: true, ownerId: true, stage: true },
    });

    if (stuck.length === 0) return;

    await this.prisma.pipelineEntry.updateMany({
      where: { id: { in: stuck.map((e) => e.id) } },
      data: { isStuck: true, stuckSince: new Date() },
    });

    // Notify each owner
    for (const entry of stuck) {
      if (!entry.ownerId) continue;
      void this.notifications.send({
        recipientId: entry.ownerId,
        eventCode: 'pipeline.entry_stuck',
        subject: `فرصة بيعية راكدة منذ ${STUCK_DAYS_THRESHOLD} يوماً`,
        body: `المرحلة: ${entry.stage} — لم يحدث تحريك منذ أكثر من أسبوعين`,
        deepLink: '/pipeline',
        payload: { entryId: entry.id },
      });
    }
  }

  private mapStageToLeadStatus(stage: PipelineStage): LeadStatus | null {
    switch (stage) {
      case PipelineStage.FIRST_CONTACT_MADE:
      case PipelineStage.MEETING_SCHEDULED:
      case PipelineStage.MEETING_DONE:
        return LeadStatus.IN_PROGRESS;
      case PipelineStage.RFQ_SUBMITTED:
      case PipelineStage.QUOTE_IN_PREPARATION:
      case PipelineStage.QUOTE_SENT_TO_CLIENT:
      case PipelineStage.NEGOTIATION_REVISION:
        return LeadStatus.QUALIFIED;
      case PipelineStage.WON:
        return LeadStatus.QUALIFIED;
      case PipelineStage.LOST:
        return LeadStatus.DISQUALIFIED;
      default:
        return null;
    }
  }
}
