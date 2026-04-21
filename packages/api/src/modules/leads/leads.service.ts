import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadStatus, Prisma, SLAStatus } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentService } from './assignment.service';
import type { AssignLeadDto } from './dto/assign-lead.dto';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { LeadFilterDto } from './dto/lead-filter.dto';
import type { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';

const DEFAULT_SLA_RESPONSE_HOURS = 24;

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: [
    LeadStatus.ASSIGNED,
    LeadStatus.CONTACTED,
    LeadStatus.UNQUALIFIED,
    LeadStatus.DUPLICATE,
  ],
  ASSIGNED: [
    LeadStatus.CONTACTED,
    LeadStatus.UNQUALIFIED,
    LeadStatus.LOST,
    LeadStatus.DUPLICATE,
  ],
  CONTACTED: [
    LeadStatus.QUALIFIED,
    LeadStatus.UNQUALIFIED,
    LeadStatus.LOST,
    LeadStatus.DUPLICATE,
  ],
  QUALIFIED: [LeadStatus.CONVERTED, LeadStatus.LOST, LeadStatus.UNQUALIFIED],
  UNQUALIFIED: [LeadStatus.QUALIFIED],
  CONVERTED: [],
  LOST: [],
  DUPLICATE: [],
};

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly assignment: AssignmentService,
  ) {}

  async create(dto: CreateLeadDto, actorId?: string) {
    const leadNumber = await this.generateLeadNumber();
    const slaHours =
      this.config.get<number>('leads.slaResponseHours') ??
      (await this.readSlaResponseHoursFromSettings()) ??
      DEFAULT_SLA_RESPONSE_HOURS;

    const slaResponseDue = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const isReturning = await this.detectReturningClient(dto.email, dto.phone);

    // When the caller didn't pick an assignee, fall back to the configured
    // auto-assign strategy.
    const effectiveAssigneeId =
      dto.assignedToId ?? (await this.assignment.pickAssignee()) ?? undefined;

    const data: Prisma.LeadCreateInput = {
      leadNumber,
      channel: dto.channel,
      source: dto.source,
      referenceNumber: dto.referenceNumber,
      contactName: dto.contactName,
      companyName: dto.companyName,
      email: dto.email,
      phone: dto.phone,
      alternatePhone: dto.alternatePhone,
      serviceDetails: dto.serviceDetails,
      projectLocation: dto.projectLocation,
      projectSize: dto.projectSize,
      budget: dto.budget,
      timeline: dto.timeline,
      priority: dto.priority,
      etimadNumber: dto.etimadNumber,
      fursaNumber: dto.fursaNumber,
      tenderDeadline: dto.tenderDeadline ? new Date(dto.tenderDeadline) : null,
      tenderDetails: dto.tenderDetails as Prisma.InputJsonValue | undefined,
      referredBy: dto.referredBy,
      referrerPhone: dto.referrerPhone,
      referrerCompany: dto.referrerCompany,
      socialPlatform: dto.socialPlatform,
      socialProfile: dto.socialProfile,
      mapsLink: dto.mapsLink,
      mapsReview: dto.mapsReview,
      initialNotes: dto.initialNotes,
      slaResponseDue,
      slaStatus: SLAStatus.ON_TIME,
      isReturningClient: isReturning,
      createdBy: actorId,
      status: effectiveAssigneeId ? LeadStatus.ASSIGNED : LeadStatus.NEW,
    };

    if (dto.serviceId) {
      data.service = { connect: { id: dto.serviceId } };
    }
    if (effectiveAssigneeId) {
      data.assignedTo = { connect: { id: effectiveAssigneeId } };
      data.assignedAt = new Date();
    }

    return this.prisma.lead.create({ data });
  }

  async autoAssign(id: string) {
    const lead = await this.findOne(id);
    const pickedId = await this.assignment.pickAssignee();
    if (!pickedId) {
      throw new BadRequestException(
        'Auto-assign is disabled or no eligible rep is available',
      );
    }
    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        assignedTo: { connect: { id: pickedId } },
        assignedAt: new Date(),
        status:
          lead.status === LeadStatus.NEW ? LeadStatus.ASSIGNED : lead.status,
      },
    });
  }

  async findAll(filter: LeadFilterDto) {
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
    };

    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.slaStatus) where.slaStatus = filter.slaStatus;
    if (filter.assignedToId) where.assignedToId = filter.assignedToId;
    if (filter.serviceId) where.serviceId = filter.serviceId;
    if (filter.location) {
      where.projectLocation = {
        contains: filter.location,
        mode: 'insensitive',
      };
    }
    if (filter.budgetMin !== undefined || filter.budgetMax !== undefined) {
      where.budget = {
        ...(filter.budgetMin !== undefined ? { gte: filter.budgetMin } : {}),
        ...(filter.budgetMax !== undefined ? { lte: filter.budgetMax } : {}),
      };
    }

    if (filter.createdFrom || filter.createdTo) {
      where.createdAt = {
        ...(filter.createdFrom ? { gte: new Date(filter.createdFrom) } : {}),
        ...(filter.createdTo ? { lte: new Date(filter.createdTo) } : {}),
      };
    }

    if (filter.search) {
      const search = filter.search.trim();
      where.OR = [
        { leadNumber: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const sort = filter.sort ?? 'createdAt';
    const order = filter.order === 'asc' ? 'asc' : 'desc';

    const [total, data] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order } as Prisma.LeadOrderByWithRelationInput,
        include: {
          service: { select: { id: true, name: true, code: true } },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
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
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        service: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async findByNumber(leadNumber: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { leadNumber, deletedAt: null },
      include: {
        service: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadNumber} not found`);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findOne(id);

    const { serviceId, assignedToId, tenderDeadline, tenderDetails, ...rest } =
      dto;

    const data: Prisma.LeadUpdateInput = { ...rest };
    if (tenderDeadline !== undefined) {
      data.tenderDeadline = tenderDeadline ? new Date(tenderDeadline) : null;
    }
    if (tenderDetails !== undefined) {
      data.tenderDetails = tenderDetails as Prisma.InputJsonValue;
    }
    if (serviceId !== undefined) {
      data.service = serviceId
        ? { connect: { id: serviceId } }
        : { disconnect: true };
    }
    if (assignedToId !== undefined) {
      data.assignedTo = assignedToId
        ? { connect: { id: assignedToId } }
        : { disconnect: true };
      data.assignedAt = assignedToId ? new Date() : null;
    }

    return this.prisma.lead.update({ where: { id }, data });
  }

  async assign(id: string, dto: AssignLeadDto) {
    const lead = await this.findOne(id);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Assignee must be an active user');
    }

    return this.prisma.lead.update({
      where: { id },
      data: {
        assignedTo: { connect: { id: dto.assignedToId } },
        assignedAt: new Date(),
        status:
          lead.status === LeadStatus.NEW ? LeadStatus.ASSIGNED : lead.status,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateLeadStatusDto) {
    const lead = await this.findOne(id);
    const allowed = ALLOWED_TRANSITIONS[lead.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition ${lead.status} → ${dto.status}`,
      );
    }

    const requiresReason =
      dto.status === LeadStatus.LOST || dto.status === LeadStatus.UNQUALIFIED;
    if (requiresReason && !dto.reason) {
      throw new BadRequestException(
        `A reason is required when moving to ${dto.status}`,
      );
    }

    const data: Prisma.LeadUpdateInput = { status: dto.status };
    if (dto.status === LeadStatus.CONTACTED && !lead.firstResponseAt) {
      data.firstResponseAt = new Date();
    }
    if (
      dto.status === LeadStatus.LOST ||
      dto.status === LeadStatus.CONVERTED ||
      dto.status === LeadStatus.UNQUALIFIED ||
      dto.status === LeadStatus.DUPLICATE
    ) {
      data.closedAt = new Date();
    }
    if (dto.reason) {
      data.lostReason = dto.reason;
    }

    return this.prisma.lead.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async stats() {
    const where: Prisma.LeadWhereInput = { deletedAt: null };

    const [total, byStatus, byChannel, bySla, todayCount] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['channel'],
        where,
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['slaStatus'],
        where,
        _count: { _all: true },
      }),
      this.prisma.lead.count({
        where: {
          ...where,
          createdAt: { gte: startOfToday() },
        },
      }),
    ]);

    return {
      total,
      todayCount,
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      byChannel: byChannel.map((row) => ({
        channel: row.channel,
        count: row._count._all,
      })),
      bySla: bySla.map((row) => ({
        slaStatus: row.slaStatus,
        count: row._count._all,
      })),
    };
  }

  private async generateLeadNumber(): Promise<string> {
    // Order by leadNumber desc so LEAD-YYYY-9999 beats LEAD-YYYY-0001 even if
    // seeded rows share the same createdAt millisecond.
    const last = await this.prisma.lead.findFirst({
      orderBy: { leadNumber: 'desc' },
      select: { leadNumber: true },
    });
    return nextEntityNumber('LEAD', last?.leadNumber);
  }

  private async detectReturningClient(email?: string, phone?: string) {
    if (!email && !phone) return false;
    const match = await this.prisma.lead.findFirst({
      where: {
        deletedAt: null,
        OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      },
      select: { id: true },
    });
    return Boolean(match);
  }

  private async readSlaResponseHoursFromSettings(): Promise<number | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'sla_lead_response_hours' },
    });
    if (!setting) return null;
    const value = Number(setting.value);
    return Number.isFinite(value) ? value : null;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
