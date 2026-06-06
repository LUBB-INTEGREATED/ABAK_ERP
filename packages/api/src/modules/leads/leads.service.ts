import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadStatus, PipelineStage, Prisma, SLAStatus } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssignmentService } from './assignment.service';
import {
  assertOwnerOrCreator,
  ownerOrCreatorScopeFilter,
  type ScopeContext,
} from '../auth/scope.util';
import type { AssignLeadDto } from './dto/assign-lead.dto';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { LeadFilterDto } from './dto/lead-filter.dto';
import type { LogLeadInteractionDto } from './dto/log-interaction.dto';
import type { RequestRfqDto } from './dto/request-rfq.dto';
import type { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';

const DEFAULT_SLA_RESPONSE_HOURS = 24;

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  INCOMING: [
    LeadStatus.ASSIGNED,
    LeadStatus.IN_PROGRESS,
    LeadStatus.DISQUALIFIED,
  ],
  ASSIGNED: [LeadStatus.IN_PROGRESS, LeadStatus.DISQUALIFIED],
  IN_PROGRESS: [LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED],
  QUALIFIED: [LeadStatus.DISQUALIFIED],
  // CONVERTED is set by the convert-to-client / request-RFQ flows, not by the
  // manual status endpoint. It is effectively terminal here; a converted lead
  // can still be marked lost (DISQUALIFIED) if the deal collapses.
  CONVERTED: [LeadStatus.DISQUALIFIED],
  DISQUALIFIED: [LeadStatus.QUALIFIED],
  TENDER_PENDING: [LeadStatus.TENDER_ACTIVE, LeadStatus.DISQUALIFIED],
  TENDER_ACTIVE: [LeadStatus.TENDER_SUBMITTED, LeadStatus.DISQUALIFIED],
  TENDER_SUBMITTED: [LeadStatus.TENDER_WON, LeadStatus.TENDER_LOST],
  TENDER_WON: [],
  TENDER_LOST: [],
};

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly assignment: AssignmentService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * One-click "Request RFQ" from a lead (CORRECTED_CLIENT_JOURNEY Activity B).
   * In one transaction: ensure a client (reuse a duplicate by phone/email, else
   * create one owned by the sales rep), mark the lead CONVERTED, ensure a
   * READY_FOR_RFQ pipeline opportunity, and create the RFQ. The owner is the
   * *owning salesperson* — the client's account manager, else the lead assignee,
   * else the actor — so the client account manager, the opportunity owner, and
   * the RFQ's originalSalesRep all line up and the records stay visible to that
   * salesperson under OWN scope. The selected ServiceCategory ids are persisted
   * structurally on `rfq.requestedCategoryIds`, which drives department routing
   * + visibility (see the DEPARTMENT branch of rfqs.list) and the manager
   * notifications fired after commit.
   */
  async requestRfq(
    leadId: string,
    dto: RequestRfqDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ): Promise<{
    rfqId: string;
    rfqNumber: string;
    clientId: string;
    leadId: string;
  }> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    // Row-level scope: a non-ALL actor (Sales Rep) may only raise an RFQ on a
    // lead they own or created. This makes the cross-rep owner mismatch (B1)
    // impossible by construction — the resolved owner below is the actor in the
    // normal flow.
    assertOwnerOrCreator(scopeCtx, lead, 'assignedToId');

    // Resolve department names for the human-readable RFQ scope.
    const categories = dto.departmentIds.length
      ? await this.prisma.serviceCategory.findMany({
          where: { id: { in: dto.departmentIds } },
          select: { name: true },
        })
      : [];
    const deptNames = categories.map((c) => c.name);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Ensure a client — reuse an existing one (returning client) or create.
      //    Resolve the owning salesperson as we go: an existing client keeps its
      //    account manager; a brand-new client is owned by the lead assignee
      //    (or the actor). ownerId then flows to the opportunity + the RFQ.
      let clientId = lead.clientId;
      let ownerId: string;
      if (clientId) {
        const current = await tx.client.findUnique({
          where: { id: clientId },
          select: { accountManagerId: true },
        });
        ownerId = current?.accountManagerId ?? lead.assignedToId ?? actorId;
      } else {
        const orConds: Prisma.ClientWhereInput[] = [{ phone: lead.phone }];
        if (lead.email) orConds.push({ email: lead.email });
        const existing = await tx.client.findFirst({
          where: { deletedAt: null, OR: orConds },
          select: { id: true, accountManagerId: true },
        });
        if (existing) {
          clientId = existing.id;
          ownerId = existing.accountManagerId ?? lead.assignedToId ?? actorId;
        } else {
          ownerId = lead.assignedToId ?? actorId;
          const lastClient = await tx.client.findFirst({
            orderBy: { clientNumber: 'desc' },
            select: { clientNumber: true },
          });
          const client = await tx.client.create({
            data: {
              clientNumber: nextEntityNumber(
                'CLIENT',
                lastClient?.clientNumber,
              ),
              contactName: lead.contactName,
              companyName: lead.companyName,
              email: lead.email,
              phone: lead.phone,
              city: lead.city,
              accountManagerId: ownerId,
              createdBy: actorId,
            },
            select: { id: true },
          });
          clientId = client.id;
        }
      }

      // 2. Mark the lead CONVERTED (client created + RFQ raised) in one step.
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          clientId,
          status: LeadStatus.CONVERTED,
          isReturningClient: true,
          closedAt: new Date(),
        },
      });

      // 3. Ensure a READY_FOR_RFQ opportunity (one per lead; one RFQ per opp).
      const existingOpp = await tx.pipelineEntry.findUnique({
        where: { leadId: lead.id },
        include: { rfq: { select: { id: true } } },
      });
      if (existingOpp?.rfq) {
        throw new BadRequestException('An RFQ already exists for this lead.');
      }
      const opportunity = existingOpp
        ? await tx.pipelineEntry.update({
            where: { id: existingOpp.id },
            data: {
              clientId,
              ownerId: existingOpp.ownerId ?? ownerId,
              stage: PipelineStage.READY_FOR_RFQ,
              readyForRfqAt: new Date(),
              ...(dto.estimatedValue !== undefined
                ? { estimatedValue: dto.estimatedValue }
                : {}),
            },
            select: { id: true },
          })
        : await tx.pipelineEntry.create({
            data: {
              leadId: lead.id,
              clientId,
              ownerId,
              stage: PipelineStage.READY_FOR_RFQ,
              readyForRfqAt: new Date(),
              estimatedValue: dto.estimatedValue,
            },
            select: { id: true },
          });

      // 4. Create the RFQ, owned by the sales rep.
      const lastRfq = await tx.rfq.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { rfqNumber: true },
      });
      const projectScope = deptNames.length
        ? `${dto.projectScope}\n\n— Requested departments: ${deptNames.join(', ')}`
        : dto.projectScope;
      const rfq = await tx.rfq.create({
        data: {
          rfqNumber: nextEntityNumber('RFQ', lastRfq?.rfqNumber),
          opportunityId: opportunity.id,
          clientId,
          serviceType: dto.serviceType,
          projectScope,
          priority: dto.priority ?? 'NORMAL',
          requestedByChannel: dto.requestedByChannel ?? 'INTERNAL_REP',
          originalSalesRepId: ownerId,
          // Structured service selection — drives department routing + the
          // manager visibility branch in rfqs.list (D1/D2).
          requestedCategoryIds: dto.departmentIds,
          // DM-1: thin RFQ starts at SUBMITTED (was RECEIVED).
          status: 'SUBMITTED',
          createdBy: actorId,
        },
        select: { id: true, rfqNumber: true },
      });

      return {
        rfqId: rfq.id,
        rfqNumber: rfq.rfqNumber,
        clientId,
        leadId: lead.id,
      };
    });

    // Route + notify after commit (best-effort): every department manager whose
    // department offers one of the selected service categories is alerted so a
    // freshly-raised, still-unassigned RFQ reaches the people who must assign
    // pricers. Multi-service RFQs additionally ping the Sales Managers, who
    // designate the cross-department Lead Pricer.
    void this.routeRfqToManagers(
      result.rfqId,
      result.rfqNumber,
      dto.departmentIds,
      deptNames,
    );

    return result;
  }

  /** D3 — notify the department managers (and, for multi-service RFQs, the
   * Sales Managers) that a new RFQ is awaiting pricer assignment. The
   * ServiceCategory -> Department -> managerId hop is the DepartmentService
   * join. Best-effort; never blocks the RFQ creation. */
  private async routeRfqToManagers(
    rfqId: string,
    rfqNumber: string,
    categoryIds: string[],
    deptNames: string[],
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
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const servicesLabel = deptNames.join('، ') || rfqNumber;
      if (managerIds.length) {
        await this.notifications.sendToMany(managerIds, {
          eventCode: 'rfq.received',
          subject: `طلب تسعير جديد بانتظار التعيين: ${rfqNumber}`,
          body: `الخدمات المطلوبة: ${servicesLabel}`,
          deepLink: `/rfqs/${rfqId}`,
          payload: { rfqId, rfqNumber },
        });
      }
      if (categoryIds.length > 1) {
        const salesManagers = await this.prisma.user.findMany({
          where: {
            role: { in: ['SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'] },
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (salesManagers.length) {
          await this.notifications.sendToMany(
            salesManagers.map((m) => m.id),
            {
              eventCode: 'rfq.multi_dept_received',
              subject: `طلب تسعير متعدد الأقسام: ${rfqNumber}`,
              body: `يتطلب تعيين منسّق رئيسي (Lead Pricer) عبر الأقسام: ${servicesLabel}`,
              deepLink: `/rfqs/${rfqId}`,
              payload: { rfqId, rfqNumber },
            },
          );
        }
      }
    } catch {
      // best-effort routing — never break RFQ creation on a notification error
    }
  }

  async create(dto: CreateLeadDto, actorId?: string) {
    const leadNumber = await this.generateLeadNumber();
    const slaHours =
      this.config.get<number>('leads.slaResponseHours') ??
      (await this.readSlaResponseHoursFromSettings()) ??
      DEFAULT_SLA_RESPONSE_HOURS;

    const slaResponseDue = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const isReturning = await this.detectReturningClient(dto.email, dto.phone);

    // When the caller didn't pick an assignee, fall back to the configured
    // auto-assign strategy, then to the creator. Defaulting to the creator (A2)
    // guarantees a rep who creates a lead can see it under OWN scope
    // ({ assignedToId: self }); an explicit pick or an auto-assign result still
    // wins. `actorId` is undefined for the public chatbot intake, leaving the
    // lead in the INCOMING queue as before.
    const effectiveAssigneeId =
      dto.assignedToId ?? (await this.assignment.pickAssignee()) ?? actorId;

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
      qualificationNotes: dto.qualificationNotes,
      lostReason: dto.lostReason,
      // BPD channel-specific fields
      city: dto.city,
      district: dto.district,
      referralSourceType: dto.referralSourceType,
      expectedBudgetRange: dto.expectedBudgetRange,
      clientUrgency: dto.clientUrgency,
      socialUsername: dto.socialUsername,
      relatedCampaign: dto.relatedCampaign,
      webSource: dto.webSource,
      mapContactMethod: dto.mapContactMethod,
      mapHowFoundUs: dto.mapHowFoundUs,
      slaResponseDue,
      slaStatus: SLAStatus.ON_TIME,
      isReturningClient: isReturning,
      createdBy: actorId,
      status: effectiveAssigneeId ? LeadStatus.ASSIGNED : LeadStatus.INCOMING,
    };

    if (dto.serviceId) {
      data.service = { connect: { id: dto.serviceId } };
    }
    if (effectiveAssigneeId) {
      data.assignedTo = { connect: { id: effectiveAssigneeId } };
      data.assignedAt = new Date();
    }

    const lead = await this.prisma.lead.create({ data });

    // Notify assignee of new lead
    if (effectiveAssigneeId) {
      void this.notifications.send({
        recipientId: effectiveAssigneeId,
        eventCode: 'lead.assigned',
        subject: `تم تعيين عميل محتمل جديد لك: ${lead.leadNumber}`,
        body: `العميل: ${lead.contactName ?? lead.companyName ?? lead.leadNumber}`,
        deepLink: `/leads/${lead.id}`,
        payload: { leadId: lead.id, leadNumber: lead.leadNumber },
      });
    }

    // Notify managers when a returning/duplicate client submits a new lead
    if (isReturning) {
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
          eventCode: 'lead.duplicate_detected',
          subject: `عميل عائد — ${lead.leadNumber}`,
          body: `تم استلام طلب جديد من عميل سبق التواصل معه: ${lead.contactName ?? lead.companyName}`,
          deepLink: `/leads/${lead.id}`,
          payload: { leadId: lead.id, leadNumber: lead.leadNumber },
        },
      );
    }

    return lead;
  }

  async autoAssign(id: string, scopeCtx?: ScopeContext) {
    const lead = await this.findOne(id, scopeCtx);
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
          lead.status === LeadStatus.INCOMING
            ? LeadStatus.ASSIGNED
            : lead.status,
      },
    });
  }

  async findAll(filter: LeadFilterDto, scopeCtx?: ScopeContext) {
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

    // Row-level scope: non-ALL viewers (e.g. Sales Rep) see leads assigned to
    // them OR that they created (so a lead auto-assigned elsewhere on creation
    // stays visible to its creator). Wrapped in AND to not collide with search OR.
    const leadScope = ownerOrCreatorScopeFilter(scopeCtx, 'assignedToId');
    if (Object.keys(leadScope).length) {
      where.AND = [leadScope as Prisma.LeadWhereInput];
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

  async findOne(id: string, scopeCtx?: ScopeContext) {
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
    // Object-level scope: a non-ALL actor may access a lead assigned to them or
    // that they created (mirrors the list filter).
    assertOwnerOrCreator(scopeCtx, lead, 'assignedToId');
    return lead;
  }

  async findByNumber(leadNumber: string, scopeCtx?: ScopeContext) {
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
    // LEAD-YYYY-XXXX is sequential — guard the by-number lookup too.
    assertOwnerOrCreator(scopeCtx, lead, 'assignedToId');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, scopeCtx?: ScopeContext) {
    await this.findOne(id, scopeCtx);

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

  async assign(id: string, dto: AssignLeadDto, scopeCtx?: ScopeContext) {
    const lead = await this.findOne(id, scopeCtx);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      select: { id: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Assignee must be an active user');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        assignedTo: { connect: { id: dto.assignedToId } },
        assignedAt: new Date(),
        status:
          lead.status === LeadStatus.INCOMING
            ? LeadStatus.ASSIGNED
            : lead.status,
      },
    });

    void this.notifications.send({
      recipientId: dto.assignedToId,
      eventCode: 'lead.assigned',
      subject: `تم تعيين عميل محتمل لك: ${lead.leadNumber}`,
      body: `العميل: ${lead.contactName ?? lead.companyName ?? lead.leadNumber}`,
      deepLink: `/leads/${lead.id}`,
      payload: { leadId: lead.id, leadNumber: lead.leadNumber },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateLeadStatusDto,
    scopeCtx?: ScopeContext,
  ) {
    const lead = await this.findOne(id, scopeCtx);
    const allowed = ALLOWED_TRANSITIONS[lead.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition ${lead.status} → ${dto.status}`,
      );
    }

    const requiresReason = dto.status === LeadStatus.DISQUALIFIED;
    if (requiresReason && !dto.reason) {
      throw new BadRequestException(
        `A reason is required when moving to ${dto.status}`,
      );
    }

    const data: Prisma.LeadUpdateInput = { status: dto.status };
    if (dto.status === LeadStatus.IN_PROGRESS && !lead.firstResponseAt) {
      data.firstResponseAt = new Date();
    }
    if (
      dto.status === LeadStatus.DISQUALIFIED ||
      dto.status === LeadStatus.QUALIFIED ||
      dto.status === LeadStatus.TENDER_WON ||
      dto.status === LeadStatus.TENDER_LOST
    ) {
      data.closedAt = new Date();
    }
    if (dto.reason) {
      data.lostReason = dto.reason;
    }

    return this.prisma.lead.update({ where: { id }, data });
  }

  async softDelete(id: string, scopeCtx?: ScopeContext) {
    await this.findOne(id, scopeCtx);
    return this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async stats(scopeCtx?: ScopeContext) {
    const where: Prisma.LeadWhereInput = { deletedAt: null };
    // DATA-3: scope the KPI cards exactly like the list (findAll) so a scoped
    // actor's headline totals match their scoped list (no inflated globals).
    const leadScope = ownerOrCreatorScopeFilter(scopeCtx, 'assignedToId');
    if (Object.keys(leadScope).length) {
      where.AND = [leadScope as Prisma.LeadWhereInput];
    }

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

  // M1-016 — duplicate detection (non-blocking, 30-day window).
  async findDuplicates(params: { email?: string; phone?: string }) {
    if (!params.email && !params.phone) return [];
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: since },
        OR: [
          ...(params.email ? [{ email: params.email }] : []),
          ...(params.phone ? [{ phone: params.phone }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        leadNumber: true,
        contactName: true,
        companyName: true,
        channel: true,
        status: true,
        createdAt: true,
      },
      take: 10,
    });
  }

  // M1-017 — AI chatbot intake. Accepts a minimal payload from the chatbot
  // and creates a lead with channel=AI_CHATBOT. No auth required on the
  // public route; controller enforces a shared-secret header.
  async createFromChatbot(dto: {
    contactName: string;
    phone: string;
    email?: string;
    companyName?: string;
    serviceDetails?: string;
    projectLocation?: string;
    conversationId?: string;
  }) {
    return this.create({
      channel: 'AI_CHATBOT' as never,
      source: `chatbot${dto.conversationId ? `:${dto.conversationId}` : ''}`,
      contactName: dto.contactName,
      phone: dto.phone,
      email: dto.email,
      companyName: dto.companyName,
      serviceDetails: dto.serviceDetails,
      projectLocation: dto.projectLocation,
    } as CreateLeadDto);
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

  // ============================================================
  // Communications log on a lead (2026-05-21 process correction).
  // The Sales Person is the single thread-of-record for the client; this
  // endpoint stores call/meeting/email/WhatsApp/site-visit log entries
  // against the lead. CC list lets non-sales actors (e.g. a Department
  // Engineer logging site-visit coordination directly with the client)
  // route the entry into the Sales Person's queue without making them a
  // bottleneck. See docs/CORRECTED_CLIENT_JOURNEY.md §A.
  // ============================================================

  async listInteractions(leadId: string, scopeCtx?: ScopeContext) {
    await this.findOne(leadId, scopeCtx);
    return this.prisma.interaction.findMany({
      where: { leadId },
      orderBy: { occurredAt: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async logInteraction(
    leadId: string,
    dto: LogLeadInteractionDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.findOne(leadId, scopeCtx);
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const followUpDate = dto.followUpDate ? new Date(dto.followUpDate) : null;

    return this.prisma.interaction.create({
      data: {
        leadId,
        authorId: actorId,
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        summary: dto.summary,
        occurredAt,
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        outcome: dto.outcome,
        nextAction: dto.nextAction,
        ccAuthorIds: dto.ccAuthorIds ?? [],
        followUpDate,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
