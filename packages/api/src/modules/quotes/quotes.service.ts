import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  DiscountType,
  POStatus,
  Prisma,
  QuoteStatus,
  UserRole,
} from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
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

const TIER_1_THRESHOLD_KEY = 'approval_threshold_tier1';
const TIER_2_THRESHOLD_KEY = 'approval_threshold_tier2';

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
  constructor(private readonly prisma: PrismaService) {}

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
    if (tiers.length === 0) {
      return this.prisma.quote.update({
        where: { id },
        data: { status: QuoteStatus.APPROVED },
        include: QUOTE_INCLUDE,
      });
    }

    const approverId =
      dto.approverId ?? (await this.pickApprover(tiers[0]))?.id;
    if (!approverId) {
      throw new BadRequestException(
        `No eligible approver for tier ${tiers[0]} — supply approverId explicitly`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quoteApproval.createMany({
        data: tiers.map((tier, index) => ({
          quoteId: id,
          tier,
          approverId: index === 0 ? approverId : approverId,
        })),
      });
      return tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.PENDING_APPROVAL },
        include: QUOTE_INCLUDE,
      });
    });
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

    return this.prisma.$transaction(async (tx) => {
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
          await tx.quote.update({
            where: { id: quoteId },
            data: { status: QuoteStatus.APPROVED },
          });
        }
      }

      return updated;
    });
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

  async accept(id: string) {
    const quote = await this.findOne(id);
    if (
      quote.status !== QuoteStatus.SENT &&
      quote.status !== QuoteStatus.VIEWED &&
      quote.status !== QuoteStatus.UNDER_NEGOTIATION
    ) {
      throw new BadRequestException(
        'Only SENT / VIEWED / UNDER_NEGOTIATION quotes can be accepted',
      );
    }

    const poNumber = await this.nextPoNumber();

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
      });

      await tx.purchaseOrder.create({
        data: {
          poNumber,
          quoteId: id,
          clientId: quote.clientId,
          contractValue: quote.totalAmount,
          status: POStatus.ACTIVE,
        },
      });

      await tx.client.update({
        where: { id: quote.clientId },
        data: { lifetimeValue: { increment: quote.totalAmount } },
      });
    });

    return this.findOne(id);
  }

  async reject(id: string, dto: AcceptRejectQuoteDto) {
    const quote = await this.findOne(id);
    if (
      quote.status !== QuoteStatus.SENT &&
      quote.status !== QuoteStatus.VIEWED &&
      quote.status !== QuoteStatus.UNDER_NEGOTIATION
    ) {
      throw new BadRequestException(
        'Only SENT / VIEWED / UNDER_NEGOTIATION quotes can be rejected',
      );
    }
    return this.prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedReason: dto.reason,
      },
      include: QUOTE_INCLUDE,
    });
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
        where: { ...where, status: QuoteStatus.ACCEPTED },
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
    const [tier1, tier2] = await Promise.all([
      this.readNumericSetting(TIER_1_THRESHOLD_KEY, 50_000),
      this.readNumericSetting(TIER_2_THRESHOLD_KEY, 200_000),
    ]);
    const tiers: number[] = [];
    if (total >= tier1) tiers.push(1);
    if (total >= tier2) tiers.push(2);
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
    const role = tier === 1 ? UserRole.SALES_MANAGER : UserRole.SUPER_ADMIN;
    const approver = await this.prisma.user.findFirst({
      where: { role, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    return approver;
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
