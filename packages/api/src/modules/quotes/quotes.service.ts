import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ConfirmationType,
  DiscountType,
  POStatus,
  Prisma,
  QuoteStatus,
  UserRole,
} from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  AcceptRejectQuoteDto,
  CreateQuoteDto,
  DecideApprovalDto,
  MilestoneInputDto,
  POStatusDto,
  QuoteFilterDto,
  QuoteItemInputDto,
  SubmitQuoteDto,
  UpdateQuoteDto,
} from './dto';

// BR-07: Level 1 (Technical Head / Dept Manager) AND Level 2 (Executive Director)
// approvals are ALWAYS mandatory regardless of quote value.
// Level 3 (CEO) is an optional additional approver above this threshold.
const LEVEL3_THRESHOLD_KEY = 'approval_quote_level3_threshold';

const QUOTE_INCLUDE = {
  client: {
    select: {
      id: true,
      clientNumber: true,
      contactName: true,
      companyName: true,
    },
  },
  lead: {
    select: { id: true, leadNumber: true, contactName: true },
  },
  preparedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  items: { orderBy: { position: 'asc' } },
  paymentMilestones: { orderBy: { position: 'asc' } },
  approvals: {
    include: {
      approver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { tier: 'asc' },
  },
  purchaseOrder: true,
} satisfies Prisma.QuoteInclude;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateQuoteDto, actorId?: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const quoteNumber = await this.nextQuoteNumber();
    const items = dto.items ?? [];
    const milestones = dto.milestones ?? [];
    this.validateMilestones(milestones);

    const totals = this.calculateTotals(items, {
      discountType: dto.discountType ?? DiscountType.FIXED,
      discountValue: dto.discountValue ?? 0,
      taxRate: dto.taxRate ?? 15,
    });

    return this.prisma.quote.create({
      data: {
        quoteNumber,
        clientId: dto.clientId,
        leadId: dto.leadId,
        title: dto.title,
        description: dto.description,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        deliveryTimeline: dto.deliveryTimeline,
        paymentTerms: dto.paymentTerms,
        termsAndConditions: dto.termsAndConditions,
        internalNotes: dto.internalNotes,
        clientNotes: dto.clientNotes,
        discountType: dto.discountType ?? DiscountType.FIXED,
        discountValue: dto.discountValue ?? 0,
        taxRate: dto.taxRate ?? 15,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        preparedById: actorId,
        items: {
          create: items.map((item, index) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct ?? 0,
            subtotal:
              item.quantity *
              item.unitPrice *
              (1 - (item.discountPct ?? 0) / 100),
            notes: item.notes,
            position: item.position ?? index,
          })),
        },
        paymentMilestones: {
          create: milestones.map((m, index) => ({
            description: m.description,
            percentage: m.percentage,
            amount: totals.totalAmount * (m.percentage / 100),
            daysFromStart: m.daysFromStart,
            notes: m.notes,
            position: index,
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async findAll(filter: QuoteFilterDto) {
    const where: Prisma.QuoteWhereInput = { deletedAt: null };
    if (filter.status) where.status = filter.status;
    if (filter.clientId) where.clientId = filter.clientId;
    if (filter.preparedById) where.preparedById = filter.preparedById;
    if (filter.search) {
      const search = filter.search.trim();
      where.OR = [
        { quoteNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
        { client: { contactName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.quote.count({ where }),
      this.prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              clientNumber: true,
              contactName: true,
              companyName: true,
            },
          },
          preparedBy: {
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
    const quote = await this.prisma.quote.findFirst({
      where: { id, deletedAt: null },
      include: QUOTE_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const quote = await this.findOne(id);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quotes can be edited');
    }

    const items = dto.items;
    const milestones = dto.milestones;

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.QuoteUpdateInput = {
        title: dto.title,
        description: dto.description,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        deliveryTimeline: dto.deliveryTimeline,
        paymentTerms: dto.paymentTerms,
        termsAndConditions: dto.termsAndConditions,
        internalNotes: dto.internalNotes,
        clientNotes: dto.clientNotes,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        taxRate: dto.taxRate,
      };

      if (items !== undefined) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        const totals = this.calculateTotals(items, {
          discountType: dto.discountType ?? quote.discountType,
          discountValue: dto.discountValue ?? quote.discountValue,
          taxRate: dto.taxRate ?? quote.taxRate,
        });
        data.subtotal = totals.subtotal;
        data.discountAmount = totals.discountAmount;
        data.taxAmount = totals.taxAmount;
        data.totalAmount = totals.totalAmount;
        data.items = {
          create: items.map((item, index) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct ?? 0,
            subtotal:
              item.quantity *
              item.unitPrice *
              (1 - (item.discountPct ?? 0) / 100),
            notes: item.notes,
            position: item.position ?? index,
          })),
        };
      }

      if (milestones !== undefined) {
        this.validateMilestones(milestones);
        await tx.paymentMilestone.deleteMany({ where: { quoteId: id } });
        // Recompute total if items also updated; otherwise use existing total
        const total =
          items !== undefined
            ? (data.totalAmount as number)
            : quote.totalAmount;
        data.paymentMilestones = {
          create: milestones.map((m, index) => ({
            description: m.description,
            percentage: m.percentage,
            amount: total * (m.percentage / 100),
            daysFromStart: m.daysFromStart,
            notes: m.notes,
            position: index,
          })),
        };
      }

      return tx.quote.update({
        where: { id },
        data,
        include: QUOTE_INCLUDE,
      });
    });
  }

  async submit(id: string, dto: SubmitQuoteDto) {
    const quote = await this.findOne(id);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quotes can be submitted');
    }
    if (quote.paymentMilestones.length > 0) {
      const sum = quote.paymentMilestones.reduce((s, m) => s + m.percentage, 0);
      if (Math.round(sum * 100) / 100 !== 100) {
        throw new BadRequestException(
          `Payment milestone percentages must sum to 100% (current ${sum})`,
        );
      }
    }

    const tiers = await this.requiredApprovalTiers(quote.totalAmount);
    // BR-07: tiers always contains at least [1, 2]; never skip approvals.

    const approverIdByTier = new Map<number, string>();
    // Optional override — caller may pin one tier's approver via dto.approverId.
    // When multiple tiers are in play, only assign the override to tier 1 and
    // auto-pick the remaining tiers by role.
    for (const tier of tiers) {
      const picked =
        tier === tiers[0] && dto.approverId
          ? { id: dto.approverId }
          : await this.pickApprover(tier);
      if (!picked) {
        throw new BadRequestException(
          `No eligible approver for tier ${tier} — seed a user with the required role or supply approverId`,
        );
      }
      approverIdByTier.set(tier, picked.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.quoteApproval.createMany({
        data: tiers.map((tier) => ({
          quoteId: id,
          tier,
          approverId: approverIdByTier.get(tier)!,
        })),
      });
      return tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.PENDING_APPROVAL },
        include: QUOTE_INCLUDE,
      });
    });

    // Notify tier-1 approver first (sequential workflow)
    const tier1ApproverId = approverIdByTier.get(1);
    if (tier1ApproverId) {
      void this.notifications.send({
        recipientId: tier1ApproverId,
        eventCode: 'quote.submitted_for_approval',
        subject: `عرض سعر يحتاج موافقتك: ${quote.quoteNumber}`,
        body: `بقيمة ${quote.totalAmount.toLocaleString('ar-SA')} ريال — المستوى 1`,
        deepLink: `/quotes/${id}`,
        payload: { quoteId: id, quoteNumber: quote.quoteNumber, tier: 1 },
      });
    }

    return updated;
  }

  async decideApproval(
    quoteId: string,
    approvalId: string,
    dto: DecideApprovalDto,
    actorId?: string,
  ) {
    const approval = await this.prisma.quoteApproval.findUnique({
      where: { id: approvalId },
      include: { quote: true },
    });
    if (!approval || approval.quoteId !== quoteId) {
      throw new NotFoundException('Approval not found');
    }
    if (actorId && approval.approverId !== actorId) {
      throw new BadRequestException('Only the assigned approver can decide');
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('This approval was already decided');
    }

    let allApproved = false;
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.quoteApproval.update({
        where: { id: approvalId },
        data: {
          status: dto.status,
          comments: dto.comments,
          decidedAt: new Date(),
        },
      });

      if (dto.status === ApprovalStatus.REJECTED) {
        await tx.quote.update({
          where: { id: quoteId },
          data: { status: QuoteStatus.DRAFT },
        });
      } else {
        const remaining = await tx.quoteApproval.count({
          where: { quoteId, status: ApprovalStatus.PENDING },
        });
        if (remaining === 0) {
          allApproved = true;
          await tx.quote.update({
            where: { id: quoteId },
            data: { status: QuoteStatus.APPROVED },
          });
        } else {
          // Notify next-tier approver
          const nextApproval = await tx.quoteApproval.findFirst({
            where: { quoteId, status: ApprovalStatus.PENDING },
            orderBy: { tier: 'asc' },
          });
          if (nextApproval) {
            void this.notifications.send({
              recipientId: nextApproval.approverId,
              eventCode: 'quote.submitted_for_approval',
              subject: `عرض سعر يحتاج موافقتك: ${approval.quote.quoteNumber}`,
              body: `المستوى ${nextApproval.tier} — بعد موافقة المستوى ${approval.tier}`,
              deepLink: `/quotes/${quoteId}`,
              payload: {
                quoteId,
                quoteNumber: approval.quote.quoteNumber,
                tier: nextApproval.tier,
              },
            });
          }
        }
      }

      return updated;
    });

    // Notify preparer of final outcome
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { preparedById: true, quoteNumber: true },
    });
    if (quote?.preparedById) {
      if (dto.status === ApprovalStatus.REJECTED) {
        void this.notifications.send({
          recipientId: quote.preparedById,
          eventCode: 'quote.rejected',
          subject: `تم رفض عرض السعر: ${quote.quoteNumber}`,
          body: dto.comments
            ? `السبب: ${dto.comments}`
            : 'تم رفض العرض من قِبل المعتمِد',
          deepLink: `/quotes/${quoteId}`,
          payload: { quoteId, quoteNumber: quote.quoteNumber },
        });
      } else if (allApproved) {
        void this.notifications.send({
          recipientId: quote.preparedById,
          eventCode: 'quote.all_approved',
          subject: `تمت الموافقة على عرض السعر: ${quote.quoteNumber}`,
          body: 'تمت الموافقة على جميع المستويات — يمكنك إرسال العرض للعميل',
          deepLink: `/quotes/${quoteId}`,
          payload: { quoteId, quoteNumber: quote.quoteNumber },
        });
      }
    }

    return result;
  }

  async send(id: string) {
    const quote = await this.findOne(id);
    if (quote.status !== QuoteStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED quotes can be sent');
    }
    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.SENT, sentAt: new Date() },
      include: QUOTE_INCLUDE,
    });
  }

  // BR-12 — quote WIN no longer auto-creates a PO. Instead a
  // CommercialConfirmation is recorded in PENDING state; the PO is minted
  // only after Finance validates it (see FinanceService.validateCommercial).
  async accept(
    id: string,
    dto: {
      confirmationType?: ConfirmationType;
      docUrl?: string;
      notes?: string;
    } = {},
    actorId?: string,
  ) {
    const quote = await this.findOne(id);
    if (
      quote.status !== QuoteStatus.SENT &&
      quote.status !== QuoteStatus.IN_DISCUSSION &&
      quote.status !== QuoteStatus.IN_NEGOTIATION
    ) {
      throw new BadRequestException(
        'Only SENT / IN_DISCUSSION / IN_NEGOTIATION quotes can be won',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.WON, wonAt: new Date() },
      });
      await tx.commercialConfirmation.create({
        data: {
          quoteId: id,
          type: dto.confirmationType ?? 'PO',
          contractValue: quote.totalAmount,
          docUrl: dto.docUrl,
          notes: dto.notes,
          confirmedAt: new Date(),
          createdBy: actorId,
        },
      });
    });

    // Notify finance/managers about the won quote requiring PO validation
    const recipients = await this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.FINANCE_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
        },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    void this.notifications.sendToMany(
      recipients.map((r) => r.id),
      {
        eventCode: 'quote.won',
        subject: `تم رسو العرض: ${quote.quoteNumber}`,
        body: `قيمة العقد: ${quote.totalAmount.toLocaleString('ar-SA')} ريال — بانتظار التحقق المالي`,
        deepLink: `/quotes/${id}`,
        payload: { quoteId: id, quoteNumber: quote.quoteNumber },
      },
    );

    return this.findOne(id);
  }

  async reject(id: string, dto: AcceptRejectQuoteDto) {
    const quote = await this.findOne(id);
    if (
      quote.status !== QuoteStatus.SENT &&
      quote.status !== QuoteStatus.IN_DISCUSSION &&
      quote.status !== QuoteStatus.IN_NEGOTIATION
    ) {
      throw new BadRequestException(
        'Only SENT / IN_DISCUSSION / IN_NEGOTIATION quotes can be lost',
      );
    }
    if (!dto.reasonCode) {
      throw new BadRequestException(
        'reasonCode is required when marking a quote LOST (BR-11)',
      );
    }
    return this.prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.LOST,
        lostAt: new Date(),
        lostReasonCode: dto.reasonCode,
        lostReason: dto.reason,
      },
      include: QUOTE_INCLUDE,
    });
  }

  // BR-10 — postponing a quote requires a follow-up date (max 30 days from now).
  async postpone(
    id: string,
    dto: { followUpDate: string; notes?: string },
    actorId?: string,
  ) {
    const quote = await this.findOne(id);
    if (
      quote.status !== QuoteStatus.SENT &&
      quote.status !== QuoteStatus.IN_DISCUSSION &&
      quote.status !== QuoteStatus.IN_NEGOTIATION
    ) {
      throw new BadRequestException(
        'Only SENT / IN_DISCUSSION / IN_NEGOTIATION quotes can be postponed',
      );
    }

    const followUpAt = new Date(dto.followUpDate);
    const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (isNaN(followUpAt.getTime())) {
      throw new BadRequestException('followUpDate must be a valid date');
    }
    if (followUpAt < new Date()) {
      throw new BadRequestException('followUpDate must be in the future');
    }
    if (followUpAt > maxDate) {
      throw new BadRequestException(
        'BR-10: follow-up date must be within 30 days',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.POSTPONED },
      });

      // Create a follow-up in CRM linked to the client (BR-10)
      if (quote.clientId) {
        await tx.followUp.create({
          data: {
            clientId: quote.clientId,
            title: `متابعة عرض سعر مؤجل: ${quote.quoteNumber}`,
            description: dto.notes,
            type: 'QUOTE',
            dueAt: followUpAt,
            assignedToId: quote.preparedById ?? actorId,
            createdBy: actorId,
          },
        });
      }
    });

    return this.findOne(id);
  }

  async softDelete(id: string) {
    const quote = await this.findOne(id);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quotes can be deleted');
    }
    return this.prisma.quote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // BR-08 — approved quotations may not be modified; revise creates a new
  // Quote with version = parent.version + 1, copies items + milestones,
  // links parentQuoteId, and locks the parent as REVISED.
  async revise(id: string, actorId: string) {
    const parent = await this.prisma.quote.findUnique({
      where: { id },
      include: { items: true, paymentMilestones: true, rfq: true },
    });
    if (!parent) throw new NotFoundException();
    const REVISABLE: QuoteStatus[] = [
      QuoteStatus.APPROVED,
      QuoteStatus.SENT,
      QuoteStatus.IN_DISCUSSION,
      QuoteStatus.IN_NEGOTIATION,
      QuoteStatus.LOST,
    ];
    if (!REVISABLE.includes(parent.status)) {
      throw new BadRequestException(
        'Quote cannot be revised in its current status',
      );
    }
    if (parent.status === QuoteStatus.WON) {
      throw new BadRequestException(
        'Won quotes cannot be revised — commercial confirmation already issued.',
      );
    }

    const number = await this.nextQuoteNumber();

    return this.prisma.$transaction(async (tx) => {
      const next = await tx.quote.create({
        data: {
          quoteNumber: number,
          version: parent.version + 1,
          parentQuoteId: parent.id,
          status: QuoteStatus.DRAFT,
          title: parent.title,
          description: parent.description,
          validUntil: parent.validUntil,
          deliveryTimeline: parent.deliveryTimeline,
          paymentTerms: parent.paymentTerms,
          termsAndConditions: parent.termsAndConditions,
          internalNotes: parent.internalNotes,
          clientNotes: parent.clientNotes,
          subtotal: parent.subtotal,
          discountType: parent.discountType,
          discountValue: parent.discountValue,
          discountAmount: parent.discountAmount,
          taxRate: parent.taxRate,
          taxAmount: parent.taxAmount,
          totalAmount: parent.totalAmount,
          clientId: parent.clientId,
          leadId: parent.leadId,
          preparedById: actorId,
          items: {
            create: parent.items.map((item) => ({
              serviceId: item.serviceId,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct,
              subtotal: item.subtotal,
              notes: item.notes,
              position: item.position,
            })),
          },
          paymentMilestones: {
            create: parent.paymentMilestones.map((m) => ({
              description: m.description,
              percentage: m.percentage,
              amount: m.amount,
              daysFromStart: m.daysFromStart,
              notes: m.notes,
              position: m.position,
            })),
          },
        },
        include: QUOTE_INCLUDE,
      });
      await tx.quote.update({
        where: { id: parent.id },
        data: { status: QuoteStatus.REVISED },
      });
      if (parent.rfq) {
        await tx.rfq.update({
          where: { id: parent.rfq.id },
          data: { revisionCount: { increment: 1 } },
        });
      }
      return next;
    });
  }

  // M4-015 — approver can request revisions. Flips the quote to IN_REVISION
  // and stamps a comment on the current pending approval so the preparer has
  // context for the next round.
  async requestRevision(
    quoteId: string,
    approvalId: string,
    dto: { comments: string },
    actorId?: string,
  ) {
    const approval = await this.prisma.quoteApproval.findUnique({
      where: { id: approvalId },
      include: { quote: true },
    });
    if (!approval || approval.quoteId !== quoteId) {
      throw new NotFoundException('Approval not found');
    }
    if (actorId && approval.approverId !== actorId) {
      throw new BadRequestException(
        'Only the assigned approver can request revisions',
      );
    }
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('This approval was already decided');
    }
    if (dto.comments.trim().length < 10) {
      throw new BadRequestException(
        'A comment of at least 10 characters is required.',
      );
    }

    const revised = await this.prisma.$transaction(async (tx) => {
      await tx.quoteApproval.update({
        where: { id: approvalId },
        data: {
          status: ApprovalStatus.REJECTED,
          comments: dto.comments,
          decidedAt: new Date(),
        },
      });
      return tx.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.IN_REVISION },
        include: QUOTE_INCLUDE,
      });
    });

    if (revised.preparedById) {
      void this.notifications.send({
        recipientId: revised.preparedById,
        eventCode: 'quote.revision_requested',
        subject: `طلب مراجعة عرض السعر: ${revised.quoteNumber}`,
        body: `ملاحظات المعتمِد: ${dto.comments}`,
        deepLink: `/quotes/${quoteId}`,
        payload: { quoteId, quoteNumber: revised.quoteNumber },
      });
    }

    return revised;
  }

  // M4-012 — daily cron marks SENT / IN_DISCUSSION / IN_NEGOTIATION quotes
  // as EXPIRED when validUntil has passed.
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireOverdueQuotes(): Promise<number> {
    const now = new Date();
    const candidates = await this.prisma.quote.findMany({
      where: {
        deletedAt: null,
        validUntil: { lt: now },
        status: {
          in: [
            QuoteStatus.SENT,
            QuoteStatus.IN_DISCUSSION,
            QuoteStatus.IN_NEGOTIATION,
          ],
        },
      },
      select: { id: true },
    });
    if (candidates.length === 0) return 0;
    await this.prisma.quote.updateMany({
      where: { id: { in: candidates.map((q) => q.id) } },
      data: { status: QuoteStatus.EXPIRED },
    });
    return candidates.length;
  }

  async stats() {
    const where: Prisma.QuoteWhereInput = { deletedAt: null };
    const [total, byStatus, acceptedAgg, pendingApproval] = await Promise.all([
      this.prisma.quote.count({ where }),
      this.prisma.quote.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.quote.aggregate({
        where: { ...where, status: QuoteStatus.WON },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.quote.count({
        where: { ...where, status: QuoteStatus.PENDING_APPROVAL },
      }),
    ]);

    return {
      total,
      pendingApproval,
      acceptedCount: acceptedAgg._count._all,
      acceptedValue: acceptedAgg._sum.totalAmount ?? 0,
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
        totalValue: row._sum.totalAmount ?? 0,
      })),
    };
  }

  // Purchase Orders ----------------------------------------------

  async listPurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            clientNumber: true,
            contactName: true,
            companyName: true,
          },
        },
        quote: {
          select: { id: true, quoteNumber: true, title: true },
        },
      },
    });
  }

  async updatePoStatus(id: string, dto: POStatusDto) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('PO not found');
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // Helpers ------------------------------------------------------

  private calculateTotals(
    items: QuoteItemInputDto[],
    options: {
      discountType: DiscountType;
      discountValue: number;
      taxRate: number;
    },
  ) {
    const subtotal = items.reduce(
      (sum, item) =>
        sum +
        item.quantity * item.unitPrice * (1 - (item.discountPct ?? 0) / 100),
      0,
    );
    const discountAmount =
      options.discountType === DiscountType.PERCENTAGE
        ? subtotal * (options.discountValue / 100)
        : options.discountValue;
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const taxAmount = afterDiscount * (options.taxRate / 100);
    const totalAmount = afterDiscount + taxAmount;
    return { subtotal, discountAmount, taxAmount, totalAmount };
  }

  private validateMilestones(milestones: MilestoneInputDto[]) {
    if (milestones.length === 0) return;
    const sum = milestones.reduce((s, m) => s + m.percentage, 0);
    if (Math.round(sum * 100) / 100 !== 100) {
      throw new BadRequestException(
        `Payment milestones must sum to 100% (got ${sum})`,
      );
    }
  }

  private async requiredApprovalTiers(total: number): Promise<number[]> {
    // BR-07: both Level 1 (Dept Manager) and Level 2 (Executive Director)
    // are mandatory for every quote, regardless of amount.
    const tiers: number[] = [1, 2];
    const level3Threshold = await this.readNumericSetting(
      LEVEL3_THRESHOLD_KEY,
      1_000_000,
    );
    if (total >= level3Threshold) {
      tiers.push(3);
    }
    return tiers;
  }

  private async readNumericSetting(key: string, fallback: number) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) return fallback;
    const value = Number(setting.value);
    return Number.isFinite(value) ? value : fallback;
  }

  private async pickApprover(tier: number) {
    // Tier 1 — Technical/Dept Manager; tier 2 — Executive Director (ADMIN);
    // tier 3 — CEO (SUPER_ADMIN). Fall back gracefully when not present.
    const order: Record<number, UserRole[]> = {
      1: [UserRole.TECHNICAL_MANAGER, UserRole.SALES_MANAGER, UserRole.ADMIN],
      2: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
      3: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
    };
    const candidates = order[tier] ?? [UserRole.ADMIN, UserRole.SUPER_ADMIN];
    for (const role of candidates) {
      const approver = await this.prisma.user.findFirst({
        where: { role, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (approver) return approver;
    }
    return null;
  }

  private async nextQuoteNumber() {
    const last = await this.prisma.quote.findFirst({
      orderBy: { quoteNumber: 'desc' },
      select: { quoteNumber: true },
    });
    return nextEntityNumber('QUO', last?.quoteNumber);
  }

  private async nextPoNumber() {
    const last = await this.prisma.purchaseOrder.findFirst({
      orderBy: { poNumber: 'desc' },
      select: { poNumber: true },
    });
    return nextEntityNumber('PO', last?.poNumber);
  }
}
