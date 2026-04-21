import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClientClassification,
  FollowUpStatus,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ClientFilterDto,
  CreateClientDto,
  CreateFollowUpDto,
  CreateInteractionDto,
  CreateNoteDto,
  InteractionFilterDto,
  UpdateClassificationDto,
  UpdateClientDto,
  UpdateFollowUpDto,
} from './dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  // Clients ------------------------------------------------------

  async create(dto: CreateClientDto, actorId?: string) {
    const duplicate = await this.findDuplicate(dto.phone, dto.email);
    if (duplicate) {
      throw new ConflictException({
        message: 'A client with this phone or email already exists',
        existingClientId: duplicate.id,
        existingClientNumber: duplicate.clientNumber,
      });
    }

    const clientNumber = await this.generateClientNumber();

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          clientNumber,
          contactName: dto.contactName,
          companyName: dto.companyName,
          email: dto.email,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          website: dto.website,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          region: dto.region,
          country: dto.country ?? 'Saudi Arabia',
          postalCode: dto.postalCode,
          commercialRegistration: dto.commercialRegistration,
          taxId: dto.taxId,
          classification: dto.classification ?? ClientClassification.NEW,
          creditLimit: dto.creditLimit,
          paymentTerms: dto.paymentTerms,
          accountManagerId: dto.accountManagerId,
          createdBy: actorId,
        },
      });

      if (dto.fromLeadId) {
        const lead = await tx.lead.findFirst({
          where: { id: dto.fromLeadId, deletedAt: null },
          select: { id: true, status: true },
        });
        if (!lead) {
          throw new NotFoundException(`Lead ${dto.fromLeadId} not found`);
        }
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            clientId: client.id,
            status: LeadStatus.CONVERTED,
            closedAt: new Date(),
            isReturningClient: true,
          },
        });
      }

      return client;
    });
  }

  async findAll(filter: ClientFilterDto) {
    const where: Prisma.ClientWhereInput = { deletedAt: null };
    if (filter.classification) where.classification = filter.classification;
    if (filter.status) where.status = filter.status;
    if (filter.accountManagerId)
      where.accountManagerId = filter.accountManagerId;
    if (filter.city) {
      where.city = { contains: filter.city, mode: 'insensitive' };
    }
    if (filter.region) {
      where.region = { contains: filter.region, mode: 'insensitive' };
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
        { clientNumber: { contains: search, mode: 'insensitive' } },
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
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order } as Prisma.ClientOrderByWithRelationInput,
        include: {
          accountManager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          _count: {
            select: { interactions: true, followUps: true, leads: true },
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
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        accountManager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: {
            interactions: true,
            followUps: true,
            leads: true,
            notes: true,
          },
        },
      },
    });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);

    if ((dto.phone || dto.email) && (dto.phone || dto.email)) {
      const duplicate = await this.findDuplicate(dto.phone, dto.email, id);
      if (duplicate) {
        throw new ConflictException({
          message: 'Another client already uses this phone or email',
          existingClientId: duplicate.id,
        });
      }
    }

    const { fromLeadId: _ignored, ...rest } = dto;
    return this.prisma.client.update({
      where: { id },
      data: rest,
      include: {
        accountManager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async archive(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        classification: ClientClassification.ARCHIVED,
      },
    });
  }

  async classify(id: string, dto: UpdateClassificationDto) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        classification: dto.classification,
        classificationManual: dto.manual ?? true,
      },
    });
  }

  async stats() {
    const where: Prisma.ClientWhereInput = { deletedAt: null };
    const [total, byClassification, byStatus, todayCount, avgLtv] =
      await Promise.all([
        this.prisma.client.count({ where }),
        this.prisma.client.groupBy({
          by: ['classification'],
          where,
          _count: { _all: true },
        }),
        this.prisma.client.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.client.count({
          where: { ...where, createdAt: { gte: startOfToday() } },
        }),
        this.prisma.client.aggregate({
          where,
          _avg: { lifetimeValue: true },
        }),
      ]);

    return {
      total,
      todayCount,
      averageLifetimeValue: avgLtv._avg.lifetimeValue ?? 0,
      byClassification: byClassification.map((row) => ({
        classification: row.classification,
        count: row._count._all,
      })),
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
    };
  }

  // Interactions -------------------------------------------------

  async listInteractions(clientId: string, filter: InteractionFilterDto) {
    await this.findOne(clientId);

    const where: Prisma.InteractionWhereInput = { clientId };
    if (filter.type) where.type = filter.type;
    if (filter.search) {
      const search = filter.search.trim();
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.interaction.count({ where }),
      this.prisma.interaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
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

  async addInteraction(
    clientId: string,
    dto: CreateInteractionDto,
    actorId?: string,
  ) {
    await this.findOne(clientId);

    const interaction = await this.prisma.interaction.create({
      data: {
        clientId,
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        summary: dto.summary,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        outcome: dto.outcome,
        nextAction: dto.nextAction,
        authorId: actorId,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.prisma.client.update({
      where: { id: clientId },
      data: { lastInteractionAt: interaction.occurredAt },
    });

    return interaction;
  }

  // Follow-ups ---------------------------------------------------

  async listFollowUps(clientId: string) {
    await this.findOne(clientId);
    return this.prisma.followUp.findMany({
      where: { clientId },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async createFollowUp(
    clientId: string,
    dto: CreateFollowUpDto,
    actorId?: string,
  ) {
    await this.findOne(clientId);
    return this.prisma.followUp.create({
      data: {
        clientId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        dueAt: new Date(dto.dueAt),
        assignedToId: dto.assignedToId,
        createdBy: actorId,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async updateFollowUp(id: string, dto: UpdateFollowUpDto) {
    const existing = await this.prisma.followUp.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Follow-up ${id} not found`);

    const data: Prisma.FollowUpUpdateInput = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === FollowUpStatus.COMPLETED) {
        data.completedAt = new Date();
      }
    }
    if (dto.dueAt) data.dueAt = new Date(dto.dueAt);
    if (dto.outcome !== undefined) data.outcome = dto.outcome;
    if (dto.assignedToId !== undefined) {
      data.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }

    return this.prisma.followUp.update({
      where: { id },
      data,
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  // Notes --------------------------------------------------------

  async listNotes(clientId: string) {
    await this.findOne(clientId);
    return this.prisma.clientNote.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async createNote(clientId: string, dto: CreateNoteDto, actorId?: string) {
    await this.findOne(clientId);
    return this.prisma.clientNote.create({
      data: {
        clientId,
        body: dto.body,
        tag: dto.tag,
        authorId: actorId,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async deleteNote(noteId: string) {
    const note = await this.prisma.clientNote.findUnique({
      where: { id: noteId },
    });
    if (!note) throw new NotFoundException(`Note ${noteId} not found`);
    return this.prisma.clientNote.delete({ where: { id: noteId } });
  }

  // Helpers ------------------------------------------------------

  private async findDuplicate(
    phone?: string,
    email?: string,
    excludeId?: string,
  ) {
    if (!phone && !email) return null;
    const or: Prisma.ClientWhereInput[] = [];
    if (phone) or.push({ phone });
    if (email) or.push({ email });
    return this.prisma.client.findFirst({
      where: {
        deletedAt: null,
        OR: or,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true, clientNumber: true },
    });
  }

  private async generateClientNumber(): Promise<string> {
    const last = await this.prisma.client.findFirst({
      orderBy: { clientNumber: 'desc' },
      select: { clientNumber: true },
    });
    return nextEntityNumber('CLIENT', last?.clientNumber);
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
