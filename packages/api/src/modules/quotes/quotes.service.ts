import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  ConfirmationType,
  DiscountType,
  PaymentValidationStatus,
  PhaseStatus,
  POStatus,
  Prisma,
  ProjectStatus,
  QuoteRequirementType,
  QuoteSectionStatus,
  QuoteStatus,
  RfqAssignmentStatus,
  UserRole,
} from '@prisma/client';
import { DEFAULT_PHASE_TEMPLATE } from '../projects/phase-template';
import { Cron, CronExpression } from '@nestjs/schedule';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertOwnership,
  ownerScopeFilter,
  type ScopeContext,
} from '../auth/scope.util';
import { PricingPolicyService } from '../settings/pricing-policy.service';
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
  items: {
    orderBy: { position: 'asc' },
    include: {
      // DM-11: department.order drives lead-dept-first section ordering.
      department: {
        select: { id: true, name: true, nameAr: true, order: true },
      },
      methodologyCard: true,
      ganttBlock: true,
    },
  },
  // DM-3: per-department sections + requirements (lead-pricer compile model).
  departmentSections: {
    orderBy: { createdAt: 'asc' },
    include: {
      department: {
        select: { id: true, name: true, nameAr: true, order: true },
      },
    },
  },
  requirements: { orderBy: { position: 'asc' } },
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
  // DM-11: lead-pricer dept comes first in the rendered document. Null-safe —
  // a manually-created quote has no linked RFQ.
  rfq: {
    select: {
      assignments: { select: { departmentId: true, isLeadPricer: true } },
    },
  },
} satisfies Prisma.QuoteInclude;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pricingPolicy: PricingPolicyService,
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

    const created = await this.prisma.quote.create({
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
        // Technical Scope (BPD M4)
        scopeOfWork: dto.scopeOfWork,
        deliverables: dto.deliverables,
        exclusions: dto.exclusions,
        assumptions: dto.assumptions,
        numberOfRevisions: dto.numberOfRevisions,
        items: {
          create: items.map((item, index) => ({
            serviceId: item.serviceId,
            departmentId: item.departmentId,
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
            ...(item.methodology
              ? {
                  methodologyCard: {
                    create: {
                      description: item.methodology.description,
                      steps: (item.methodology.steps ??
                        []) as unknown as Prisma.InputJsonValue,
                      deliverable: item.methodology.deliverable,
                    },
                  },
                }
              : {}),
            ...(item.gantt
              ? {
                  ganttBlock: {
                    create: {
                      startDay: item.gantt.startDay,
                      durationDays: item.gantt.durationDays,
                      categoryTone: item.gantt.categoryTone ?? '#2d7ad1',
                    },
                  },
                }
              : {}),
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
    // RV-16: group the created items under (auto-created) department sections.
    await this.prisma.$transaction((tx) =>
      this.syncItemSections(tx, created.id),
    );
    return this.prisma.quote.findUniqueOrThrow({
      where: { id: created.id },
      include: QUOTE_INCLUDE,
    });
  }

  async findAll(filter: QuoteFilterDto, scopeCtx?: ScopeContext) {
    const where: Prisma.QuoteWhereInput = { deletedAt: null };
    // Row-level scope: non-ALL viewers see only quotes they prepared.
    const quoteScope = ownerScopeFilter(scopeCtx, 'preparedById');
    if (Object.keys(quoteScope).length) {
      where.AND = [quoteScope as Prisma.QuoteWhereInput];
    }
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

  async findOne(id: string, scopeCtx?: ScopeContext) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, deletedAt: null },
      include: QUOTE_INCLUDE,
    });
    if (!quote) throw new NotFoundException('Quote not found');
    assertOwnership(scopeCtx, quote, 'preparedById');
    return quote;
  }

  async update(id: string, dto: UpdateQuoteDto, scopeCtx?: ScopeContext) {
    const quote = await this.findOne(id, scopeCtx);
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
        // Technical Scope (BPD M4)
        scopeOfWork: dto.scopeOfWork,
        deliverables: dto.deliverables,
        exclusions: dto.exclusions,
        assumptions: dto.assumptions,
        numberOfRevisions: dto.numberOfRevisions,
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
            departmentId: item.departmentId,
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
            ...(item.methodology
              ? {
                  methodologyCard: {
                    create: {
                      description: item.methodology.description,
                      steps: (item.methodology.steps ??
                        []) as unknown as Prisma.InputJsonValue,
                      deliverable: item.methodology.deliverable,
                    },
                  },
                }
              : {}),
            ...(item.gantt
              ? {
                  ganttBlock: {
                    create: {
                      startDay: item.gantt.startDay,
                      durationDays: item.gantt.durationDays,
                      categoryTone: item.gantt.categoryTone ?? '#2d7ad1',
                    },
                  },
                }
              : {}),
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

      const updated = await tx.quote.update({
        where: { id },
        data,
        include: QUOTE_INCLUDE,
      });
      // RV-16: group the (re)created items under their department sections.
      if (items !== undefined) {
        await this.syncItemSections(tx, id);
        return tx.quote.findUniqueOrThrow({
          where: { id },
          include: QUOTE_INCLUDE,
        });
      }
      return updated;
    });
  }

  /**
   * RV-16: derive QuoteItem.sectionId from departmentId. No item input DTO sets
   * sectionId, so priced items would never group under their
   * QuoteDepartmentSection (the §14 lead-reviewer model) — every item stayed
   * sectionId=null and revise()'s remap operated on data the app couldn't
   * produce. Ensure a section exists per distinct item departmentId and point
   * each item at it. Idempotent; a no-op for section-less manual quotes.
   */
  private async syncItemSections(
    tx: Prisma.TransactionClient,
    quoteId: string,
  ): Promise<void> {
    const items = await tx.quoteItem.findMany({
      where: { quoteId, departmentId: { not: null } },
      select: { id: true, departmentId: true, sectionId: true },
    });
    if (!items.length) return;
    const deptIds = [
      ...new Set(
        items.map((i) => i.departmentId).filter((d): d is string => Boolean(d)),
      ),
    ];
    const existing = await tx.quoteDepartmentSection.findMany({
      where: { quoteId, departmentId: { in: deptIds } },
      select: { id: true, departmentId: true },
    });
    const sectionByDept = new Map(existing.map((s) => [s.departmentId, s.id]));
    for (const deptId of deptIds) {
      if (!sectionByDept.has(deptId)) {
        const created = await tx.quoteDepartmentSection.create({
          data: { quoteId, departmentId: deptId },
        });
        sectionByDept.set(deptId, created.id);
      }
    }
    for (const item of items) {
      const sectionId = item.departmentId
        ? sectionByDept.get(item.departmentId)
        : undefined;
      if (sectionId && item.sectionId !== sectionId) {
        await tx.quoteItem.update({
          where: { id: item.id },
          data: { sectionId },
        });
      }
    }
  }

  async submit(id: string, dto: SubmitQuoteDto, scopeCtx?: ScopeContext) {
    const quote = await this.findOne(id, scopeCtx);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quotes can be submitted');
    }

    // DM-9: a submit-ready quote must have a positive total, at least one
    // payment milestone, and every department section priced (subtotal > 0).
    if (quote.totalAmount <= 0) {
      throw new BadRequestException(
        'Quote total must be greater than zero before submitting.',
      );
    }
    if (quote.paymentMilestones.length === 0) {
      throw new BadRequestException(
        'At least one payment milestone is required before submitting.',
      );
    }
    if (quote.departmentSections.length > 0) {
      const subtotalByDept = new Map<string, number>();
      for (const it of quote.items) {
        if (!it.departmentId) continue;
        subtotalByDept.set(
          it.departmentId,
          (subtotalByDept.get(it.departmentId) ?? 0) + it.subtotal,
        );
      }
      const unpriced = quote.departmentSections.filter(
        (s) => (subtotalByDept.get(s.departmentId) ?? 0) <= 0,
      );
      if (unpriced.length) {
        const names = unpriced.map(
          (s) => s.department?.nameAr ?? s.department?.name ?? s.departmentId,
        );
        throw new BadRequestException(
          `These department sections are not yet priced: ${names.join('، ')}`,
        );
      }

      // §14 (DM-15e): the lead-reviewer compile gate. ONLY applies to a quote
      // actually in the lead-reviewer model — i.e. one with a designated lead
      // section. A manually-built quote auto-creates a DRAFT section per item
      // department (syncItemSections) with no lead and no pricer; those must
      // still submit through the normal priced+milestone checks, so we gate on
      // the lead section's presence (RV3-1). Checked after the priced check so
      // an unpriced section surfaces the more specific "not yet priced" message.
      const leadSection = quote.departmentSections.find((s) => s.isLead);
      if (leadSection) {
        const notSubmitted = quote.departmentSections.filter(
          (s) => s.status !== QuoteSectionStatus.SUBMITTED_TO_LEAD,
        );
        if (notSubmitted.length) {
          const names = notSubmitted.map(
            (s) => s.department?.nameAr ?? s.department?.name ?? s.departmentId,
          );
          throw new BadRequestException(
            `These sections haven't been submitted to the lead yet: ${names.join('، ')}`,
          );
        }
        // Fail closed: only the lead section's pricer may submit (RV3-2). A
        // null lead pricer (anomalous in the RFQ model) blocks an actor-driven
        // submit rather than waving it through.
        if (scopeCtx?.user && leadSection.pricerId !== scopeCtx.user.id) {
          throw new ForbiddenException(
            'Only the lead reviewer can submit the offer for approval.',
          );
        }
      }
    }

    if (quote.paymentMilestones.length > 0) {
      const sum = quote.paymentMilestones.reduce((s, m) => s + m.percentage, 0);
      if (Math.round(sum * 100) / 100 !== 100) {
        throw new BadRequestException(
          `Payment milestone percentages must sum to 100% (current ${sum})`,
        );
      }
    }

    // BR-07 value-based mandatory tiers (1 = Dept Manager, 2 = Executive
    // Director, optional 3 = CEO).
    const valueTiers = await this.requiredApprovalTiers(quote.totalAmount);

    // 2026-05-21 process correction — pricing-policy-driven discount tiers.
    // Computed from the effective discount percentage on the quote; the
    // policy decides whether the discount is within the sales person's
    // ceiling (no approval) or escalates through the configured chain.
    const discountPct = this.computeEffectiveDiscountPct(quote);
    const discountChain =
      await this.pricingPolicy.resolveApprovalChain(discountPct);
    const discountTierRoles = this.resolveDiscountChainRoles(discountChain);

    const approverIdByTier = new Map<number, string>();

    // Resolve value-based approvers first (preserve historical override behaviour).
    for (const tier of valueTiers) {
      const picked =
        tier === valueTiers[0] && dto.approverId
          ? { id: dto.approverId }
          : await this.pickApprover(tier);
      if (!picked) {
        throw new BadRequestException(
          `No eligible approver for tier ${tier} — seed a user with the required role or supply approverId`,
        );
      }
      approverIdByTier.set(tier, picked.id);
    }

    // Append discount-derived approvers as additional tiers, deduplicating
    // by role to avoid double-asking the same person.
    const valueTierRoleIds = new Set(
      await Promise.all(
        Array.from(approverIdByTier.values()).map(async (uid) => {
          const u = await this.prisma.user.findUnique({
            where: { id: uid },
            select: { role: true },
          });
          return u?.role;
        }),
      ),
    );
    const tiers = [...valueTiers];
    let nextTier = (valueTiers[valueTiers.length - 1] ?? 0) + 1;
    for (const role of discountTierRoles) {
      if (valueTierRoleIds.has(role)) continue;
      const approver = await this.prisma.user.findFirst({
        where: { role, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (!approver) {
        throw new BadRequestException(
          `Pricing policy requires ${role} approval for ${discountPct}% discount but no active user with that role exists.`,
        );
      }
      approverIdByTier.set(nextTier, approver.id);
      tiers.push(nextTier);
      valueTierRoleIds.add(role);
      nextTier++;
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
        body: `بقيمة ${quote.totalAmount.toLocaleString('ar-SA')} ريال — المستوى 1${
          discountPct > 0 ? ` (خصم ${discountPct.toFixed(1)}٪)` : ''
        }`,
        deepLink: `/quotes/${id}`,
        payload: { quoteId: id, quoteNumber: quote.quoteNumber, tier: 1 },
      });
    }

    return updated;
  }

  // ----------------------------------------------------------------
  // DM-15c — §14 department-section lifecycle (lead-reviewer model)
  // ----------------------------------------------------------------

  /**
   * Compile view: every section of a quote with its status, the pricer (resolved
   * from the scalar pricerId), and the section's line items. Lead first. Scoped
   * by `quote:view` via findOne.
   */
  async listSections(quoteId: string, scopeCtx?: ScopeContext) {
    await this.findOne(quoteId, scopeCtx); // 404 + quote:view scope guard
    const sections = await this.prisma.quoteDepartmentSection.findMany({
      where: { quoteId },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true, order: true },
        },
        items: { orderBy: { position: 'asc' } },
      },
      orderBy: [{ isLead: 'desc' }, { createdAt: 'asc' }],
    });
    const pricerIds = [
      ...new Set(
        sections.map((s) => s.pricerId).filter((x): x is string => !!x),
      ),
    ];
    const pricers = pricerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: pricerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const byId = new Map(pricers.map((p) => [p.id, p]));
    return sections.map((s) => ({
      ...s,
      pricer: s.pricerId ? (byId.get(s.pricerId) ?? null) : null,
    }));
  }

  /**
   * A dept pricer submits their own section to the lead (DRAFT →
   * SUBMITTED_TO_LEAD). Guards: the caller is the section's pricer, the section
   * is priced (subtotal > 0), and it is currently DRAFT. Perm `quote:build`.
   */
  async submitSection(
    quoteId: string,
    sectionId: string,
    scopeCtx?: ScopeContext,
  ) {
    const section = await this.prisma.quoteDepartmentSection.findFirst({
      where: { id: sectionId, quoteId },
      include: {
        items: { select: { subtotal: true } },
        department: { select: { name: true, nameAr: true } },
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    // Fail closed (RV3-3): an actor may only submit the section they price. A
    // null pricerId (unassigned section) blocks the submit rather than letting
    // any quote:build holder flip it — the prior `&& section.pricerId` guard
    // waved those through (cross-department IDOR).
    if (scopeCtx?.user && section.pricerId !== scopeCtx.user.id) {
      throw new ForbiddenException(
        'Only the assigned pricer can submit this section',
      );
    }
    if (section.status !== QuoteSectionStatus.DRAFT) {
      throw new BadRequestException(
        'Only a DRAFT section can be submitted to the lead',
      );
    }
    const subtotal = section.items.reduce((s, it) => s + it.subtotal, 0);
    if (subtotal <= 0) {
      throw new BadRequestException(
        'Price the section before submitting it to the lead',
      );
    }

    return this.prisma.quoteDepartmentSection.update({
      where: { id: sectionId },
      data: { status: QuoteSectionStatus.SUBMITTED_TO_LEAD },
      include: {
        department: { select: { id: true, name: true, nameAr: true } },
      },
    });
  }

  /**
   * The lead reviewer sends a co-pricer's submitted section back for revision
   * (SUBMITTED_TO_LEAD → DRAFT) with a note. Guards: the caller is the LEAD
   * section's pricer; the target section is currently SUBMITTED_TO_LEAD. The
   * note is recorded durably on the matching RfqAssignment (existing column,
   * status → REVISION_REQUESTED) and pushed to the section's pricer. Perm
   * `quote:build`.
   */
  async requestSectionRevision(
    quoteId: string,
    sectionId: string,
    note: string | undefined,
    scopeCtx?: ScopeContext,
  ) {
    const section = await this.prisma.quoteDepartmentSection.findFirst({
      where: { id: sectionId, quoteId },
      select: {
        id: true,
        status: true,
        pricerId: true,
        departmentId: true,
        isLead: true,
      },
    });
    if (!section) throw new NotFoundException('Section not found');

    // Fail closed (RV3-4): only the lead section's pricer may bounce a section
    // back. No lead section, or a lead with no pricer, refuses the request
    // instead of letting any quote:build holder DRAFT a co-pricer's work.
    if (scopeCtx?.user) {
      const lead = await this.prisma.quoteDepartmentSection.findFirst({
        where: { quoteId, isLead: true },
        select: { pricerId: true },
      });
      if (!lead?.pricerId || lead.pricerId !== scopeCtx.user.id) {
        throw new ForbiddenException(
          'Only the lead reviewer can request a section revision',
        );
      }
    }
    if (section.isLead) {
      throw new BadRequestException(
        'The lead section cannot request a revision on itself',
      );
    }
    if (section.status !== QuoteSectionStatus.SUBMITTED_TO_LEAD) {
      throw new BadRequestException(
        'Only a section submitted to the lead can be sent back for revision',
      );
    }

    const updated = await this.prisma.quoteDepartmentSection.update({
      where: { id: sectionId },
      data: { status: QuoteSectionStatus.DRAFT },
      include: {
        department: { select: { id: true, name: true, nameAr: true } },
      },
    });

    // Durably record the revision note on the linked RFQ assignment (existing
    // column — no migration) and notify the section's pricer.
    const rfq = await this.prisma.rfq.findFirst({
      where: { quoteId },
      select: { id: true },
    });
    if (rfq) {
      await this.prisma.rfqAssignment.updateMany({
        where: { rfqId: rfq.id, departmentId: section.departmentId },
        data: {
          status: RfqAssignmentStatus.REVISION_REQUESTED,
          notes: note ?? null,
        },
      });
    }
    if (section.pricerId) {
      void this.notifications.send({
        recipientId: section.pricerId,
        eventCode: 'quote.section_revision_requested',
        subject: 'طلب تعديل على قسمك في عرض السعر',
        body: note ?? 'يرجى مراجعة القسم وإعادة إرساله للمراجع الرئيسي.',
        deepLink: `/quotes/${quoteId}`,
        payload: { quoteId, sectionId },
      });
    }

    return updated;
  }

  // ----------------------------------------------------------------
  // DM-15d — quote requirements / notes + lead dedup (§14, v1 flat list)
  // ----------------------------------------------------------------

  /**
   * Requirements may only be mutated while the parent quote is an editable
   * DRAFT (RV3-7) and not soft-deleted (RV3-9) — mirrors update()/submit(). This
   * stops requirements from being changed on an already SENT/APPROVED/WON quote
   * (they feed the §14 requirements page of the issued document) or on a
   * soft-deleted quote.
   */
  private async assertQuoteEditable(quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, deletedAt: null },
      select: { status: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        'Requirements can only be edited while the quote is a DRAFT',
      );
    }
  }

  /** A pricer adds a requirement (DOCUMENT) or note (NOTE). Perm quote:build. */
  async addRequirement(
    quoteId: string,
    dto: { type?: QuoteRequirementType; text: string; position?: number },
  ) {
    await this.assertQuoteEditable(quoteId);
    if (!dto.text?.trim())
      throw new BadRequestException('Requirement text is required');
    const max = await this.prisma.quoteRequirement.aggregate({
      where: { quoteId },
      _max: { position: true },
    });
    return this.prisma.quoteRequirement.create({
      data: {
        quoteId,
        type: dto.type ?? QuoteRequirementType.NOTE,
        text: dto.text.trim(),
        position: dto.position ?? (max._max.position ?? -1) + 1,
      },
    });
  }

  /** Edit a requirement's type / text / position. Perm quote:build. */
  async updateRequirement(
    quoteId: string,
    requirementId: string,
    dto: { type?: QuoteRequirementType; text?: string; position?: number },
  ) {
    await this.assertQuoteEditable(quoteId);
    const existing = await this.prisma.quoteRequirement.findFirst({
      where: { id: requirementId, quoteId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Requirement not found');
    const data: Prisma.QuoteRequirementUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.text !== undefined) {
      if (!dto.text.trim())
        throw new BadRequestException('Requirement text cannot be empty');
      data.text = dto.text.trim();
    }
    if (dto.position !== undefined) data.position = dto.position;
    return this.prisma.quoteRequirement.update({
      where: { id: requirementId },
      data,
    });
  }

  /** Delete a requirement. Perm quote:build. */
  async deleteRequirement(quoteId: string, requirementId: string) {
    await this.assertQuoteEditable(quoteId);
    const existing = await this.prisma.quoteRequirement.findFirst({
      where: { id: requirementId, quoteId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Requirement not found');
    await this.prisma.quoteRequirement.delete({ where: { id: requirementId } });
    return { message: 'Requirement deleted' };
  }

  /**
   * The lead reviewer merges duplicate per-department requirement lines into one
   * shared row: the kept row is flagged `isShared` and records the merged ids in
   * `dedupedFromIds`; the merged rows are deleted. Lead-only (the lead section's
   * pricer). v1 is a flat quote-level list (no per-section authorship — that
   * would be a migration).
   */
  async dedupRequirements(
    quoteId: string,
    keepId: string,
    mergeIds: string[],
    scopeCtx?: ScopeContext,
  ) {
    await this.assertQuoteEditable(quoteId);

    // Fail closed (RV3-6): the dedup is a lead-only action. No lead section, or
    // a lead with no pricer, refuses rather than letting any quote:build holder
    // merge/delete requirement rows.
    if (scopeCtx?.user) {
      const lead = await this.prisma.quoteDepartmentSection.findFirst({
        where: { quoteId, isLead: true },
        select: { pricerId: true },
      });
      if (!lead?.pricerId || lead.pricerId !== scopeCtx.user.id) {
        throw new ForbiddenException(
          'Only the lead reviewer can dedup requirements',
        );
      }
    }
    const keepExists = await this.prisma.quoteRequirement.findFirst({
      where: { id: keepId, quoteId },
      select: { id: true },
    });
    if (!keepExists)
      throw new NotFoundException('Requirement to keep not found');

    const toMergeIds = [...new Set(mergeIds)].filter((id) => id !== keepId);
    if (toMergeIds.length === 0) {
      throw new BadRequestException('No distinct requirements to merge');
    }
    const found = await this.prisma.quoteRequirement.findMany({
      where: { id: { in: toMergeIds }, quoteId },
      select: { id: true },
    });
    if (found.length !== toMergeIds.length) {
      throw new BadRequestException(
        'Some requirements to merge were not found on this quote',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // RV3-8: re-read the kept row's dedupedFromIds INSIDE the transaction so
      // two concurrent dedups don't both snapshot a stale array and clobber each
      // other's accumulated source ids with `set:`.
      const keep = await tx.quoteRequirement.findUniqueOrThrow({
        where: { id: keepId },
        select: { dedupedFromIds: true },
      });
      const updated = await tx.quoteRequirement.update({
        where: { id: keepId },
        data: {
          isShared: true,
          dedupedFromIds: {
            set: [...new Set([...keep.dedupedFromIds, ...toMergeIds])],
          },
        },
      });
      await tx.quoteRequirement.deleteMany({
        where: { id: { in: toMergeIds } },
      });
      return updated;
    });
  }

  /**
   * Effective discount % for a quote — combines line-item discounts with
   * the quote-level discount, returning a single % of pre-discount subtotal.
   * Used by the PricingPolicy approval-routing.
   */
  private computeEffectiveDiscountPct(quote: {
    subtotal: number;
    discountAmount: number;
  }): number {
    // QuoteItem.subtotal already applied per-line discounts before being
    // summed into Quote.subtotal. So the "raw" subtotal here is post-line-
    // discount. Quote.discountAmount is the additional quote-level discount.
    // We treat the total reduction as a % of raw subtotal for policy lookup.
    if (quote.subtotal <= 0) return 0;
    return (quote.discountAmount / quote.subtotal) * 100;
  }

  /**
   * Map the policy's role strings to UserRole enums. The policy stores
   * them as plain strings so it can be serialised in JSON; we resolve to
   * the actual Prisma enum here.
   */
  private resolveDiscountChainRoles(chain: string[]): UserRole[] {
    const map: Record<string, UserRole> = {
      SALES_MANAGER: UserRole.SALES_MANAGER,
      TECHNICAL_MANAGER: UserRole.TECHNICAL_MANAGER,
      FINANCE_MANAGER: UserRole.FINANCE_MANAGER,
      CEO: UserRole.SUPER_ADMIN,
    };
    return chain
      .map((role) => map[role])
      .filter((role): role is UserRole => Boolean(role));
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

  // BPD M4 — post-sending follow-up status transitions
  async setFollowUpStatus(
    id: string,
    status: 'IN_DISCUSSION' | 'IN_NEGOTIATION',
    scopeCtx?: ScopeContext,
  ) {
    const quote = await this.findOne(id, scopeCtx);
    const ELIGIBLE: QuoteStatus[] = [
      QuoteStatus.SENT,
      QuoteStatus.IN_DISCUSSION,
      QuoteStatus.IN_NEGOTIATION,
    ];
    if (!ELIGIBLE.includes(quote.status)) {
      throw new BadRequestException(
        `Cannot set ${status} — quote must be SENT, IN_DISCUSSION, or IN_NEGOTIATION`,
      );
    }
    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus[status] },
      include: QUOTE_INCLUDE,
    });
  }

  async send(id: string, scopeCtx?: ScopeContext) {
    const quote = await this.findOne(id, scopeCtx);
    if (quote.status !== QuoteStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED quotes can be sent');
    }
    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.SENT, sentAt: new Date() },
      include: QUOTE_INCLUDE,
    });

    // Auto-create a follow-up for the client 3 days from now (fire-and-forget)
    if (updated.clientId) {
      const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      void this.prisma.followUp
        .create({
          data: {
            clientId: updated.clientId,
            title: `متابعة عرض السعر: ${updated.quoteNumber}`,
            type: 'QUOTE',
            dueAt,
            assignedToId: updated.preparedById ?? undefined,
            createdBy: updated.preparedById ?? undefined,
          },
        })
        .catch(() => null);
    }

    return updated;
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
    scopeCtx?: ScopeContext,
  ) {
    const quote = await this.findOne(id, scopeCtx);
    if (
      quote.status !== QuoteStatus.SENT &&
      quote.status !== QuoteStatus.IN_DISCUSSION &&
      quote.status !== QuoteStatus.IN_NEGOTIATION
    ) {
      throw new BadRequestException(
        'Only SENT / IN_DISCUSSION / IN_NEGOTIATION quotes can be won',
      );
    }

    // DM-10: resolve the RFQ via the (DM-8 repointed) quoteId so broker
    // commission accrues against the right request.
    const linkedRfq = await this.prisma.rfq.findFirst({
      where: { quoteId: id },
      select: {
        id: true,
        rfqNumber: true,
        brokerName: true,
        brokerPhone: true,
      },
    });

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

      // DM-10: accrue broker commission ONCE per RFQ (guard against
      // double-accrual when a quote is reopened and re-won). Re-homed here from
      // the deleted RFQ recordOutcome (DM-7).
      if (linkedRfq?.brokerName) {
        const existing = await tx.commission.findFirst({
          where: { rfqId: linkedRfq.id },
          select: { id: true },
        });
        if (!existing) {
          const rateSetting = await tx.systemSetting.findUnique({
            where: { key: 'commission_rate_broker_default' },
          });
          const rate = rateSetting ? Number(rateSetting.value) : 3;
          // RV-9: accrue against the confirmed contract value at win so the
          // commission is non-zero (it was permanently 0 — nothing else ever
          // grew it, so a broker payout could be approved/PAID for SAR 0).
          // baseAmount = contract value, amount = base * rate%. A later
          // enhancement can recompute amount from validated PO payments.
          const baseAmount = quote.totalAmount;
          const amount = Math.round(baseAmount * rate) / 100;
          await tx.commission.create({
            data: {
              rfqId: linkedRfq.id,
              beneficiaryType: 'BROKER',
              beneficiaryName: linkedRfq.brokerName,
              beneficiaryPhone: linkedRfq.brokerPhone,
              baseAmount,
              rate,
              amount,
              status: 'ACCRUING',
              notes: `Auto-accrued on RFQ ${linkedRfq.rfqNumber} WON (quote ${quote.quoteNumber}): ${rate}% of ${baseAmount}.`,
            },
          });
        }
      }
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

    // Notify Finance Manager + Sales Manager about PO generated
    const poRecipients = await this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.FINANCE_MANAGER, UserRole.SALES_MANAGER] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    void this.notifications.sendToMany(
      poRecipients.map((r) => r.id),
      {
        eventCode: 'po.generated',
        subject: `أمر شراء جديد بانتظار التحقق: ${quote.quoteNumber}`,
        body: `قيمة العقد: ${quote.totalAmount.toLocaleString('ar-SA')} ريال`,
        deepLink: `/quotes/${id}`,
        payload: { quoteId: id, quoteNumber: quote.quoteNumber },
      },
    );

    return this.findOne(id);
  }

  async reject(id: string, dto: AcceptRejectQuoteDto, scopeCtx?: ScopeContext) {
    const quote = await this.findOne(id, scopeCtx);
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
    scopeCtx?: ScopeContext,
  ) {
    const quote = await this.findOne(id, scopeCtx);
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

  async softDelete(id: string, scopeCtx?: ScopeContext) {
    const quote = await this.findOne(id, scopeCtx);
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
      include: {
        items: { include: { methodologyCard: true, ganttBlock: true } },
        departmentSections: true,
        requirements: true,
        paymentMilestones: true,
        rfq: true,
      },
    });
    if (!parent) throw new NotFoundException();
    if (parent.status === QuoteStatus.WON) {
      throw new BadRequestException(
        'Won quotes cannot be revised — commercial confirmation already issued.',
      );
    }
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

    const number = await this.nextQuoteNumber();

    return this.prisma.$transaction(async (tx) => {
      // RV-13: the WON/REVISABLE gate ran OUTSIDE the tx, so two concurrent
      // revise() calls both pass it. Re-assert + flip the parent conditionally
      // here — updateMany on status∈REVISABLE lets exactly one win; the loser
      // sees count 0 and aborts BEFORE minting a duplicate version N+1 (which
      // would orphan a quote on the RFQ repoint).
      const flipped = await tx.quote.updateMany({
        where: { id: parent.id, status: { in: REVISABLE } },
        data: { status: QuoteStatus.REVISED },
      });
      if (flipped.count === 0) {
        throw new BadRequestException('Quote already revised');
      }

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
          // RV-1: carry the technical-scope fields onto the revision — a
          // revision must not silently drop the scope the renderer prints.
          scopeOfWork: parent.scopeOfWork,
          deliverables: parent.deliverables,
          exclusions: parent.exclusions,
          assumptions: parent.assumptions,
          numberOfRevisions: parent.numberOfRevisions,
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
          requirements: parent.requirements.length
            ? {
                create: parent.requirements.map((r) => ({
                  type: r.type,
                  text: r.text,
                  isShared: r.isShared,
                  dedupedFromIds: r.dedupedFromIds,
                  position: r.position,
                })),
              }
            : undefined,
        },
      });

      // DM-8: recreate the department sections and map old → new ids so the
      // line items keep their section grouping across the revision.
      const sectionIdMap = new Map<string, string>();
      for (const s of parent.departmentSections) {
        const createdSection = await tx.quoteDepartmentSection.create({
          data: {
            quoteId: next.id,
            departmentId: s.departmentId,
            pricerId: s.pricerId,
            scopeTextAr: s.scopeTextAr,
            scopeTextEn: s.scopeTextEn,
            isLead: s.isLead,
            status: s.status,
            pricingModel: s.pricingModel,
          },
        });
        sectionIdMap.set(s.id, createdSection.id);
      }

      // DM-8: carry departmentId, sectionId, methodologyCard and ganttBlock per
      // line — a revision must not lose the multi-dept grouping or the doc cards.
      for (const item of parent.items) {
        await tx.quoteItem.create({
          data: {
            quoteId: next.id,
            serviceId: item.serviceId,
            departmentId: item.departmentId,
            sectionId: item.sectionId
              ? (sectionIdMap.get(item.sectionId) ?? null)
              : null,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct,
            subtotal: item.subtotal,
            notes: item.notes,
            position: item.position,
            methodologyCard: item.methodologyCard
              ? {
                  create: {
                    description: item.methodologyCard.description,
                    steps: item.methodologyCard.steps as Prisma.InputJsonValue,
                    deliverable: item.methodologyCard.deliverable,
                  },
                }
              : undefined,
            ganttBlock: item.ganttBlock
              ? {
                  create: {
                    startDay: item.ganttBlock.startDay,
                    durationDays: item.ganttBlock.durationDays,
                    categoryTone: item.ganttBlock.categoryTone,
                  },
                }
              : undefined,
          },
        });
      }

      // (parent already flipped to REVISED at the top of the tx — RV-13.)

      // DM-8: repoint the RFQ (FK @unique) to the latest revision so the sales
      // tracker + pricing surface follow the new version, and bump the count.
      if (parent.rfq) {
        await tx.rfq.update({
          where: { id: parent.rfq.id },
          data: { quoteId: next.id, revisionCount: { increment: 1 } },
        });
      }

      return tx.quote.findUniqueOrThrow({
        where: { id: next.id },
        include: QUOTE_INCLUDE,
      });
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

  private async nextProjectNumber() {
    const last = await this.prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { projectNumber: true },
    });
    return nextEntityNumber('PRJ', last?.projectNumber);
  }

  // ============================================================
  // 1-click conversion: Won Quote → live Project
  // ============================================================
  //
  // 2026-05-21 process correction. The Department Manager clicks "Convert
  // to Project" on a Won quote and the system handles the rest in one
  // transaction:
  //
  //   1. Verify quote is Won.
  //   2. Auto-validate the commercial confirmation (if present) so the PO
  //      can be minted. Finance still validates payments downstream — only
  //      the confirmation gate is collapsed.
  //   3. Mint the PO.
  //   4. Bump client lifetimeValue by the contract value.
  //   5. Create the Project + default 7-phase template.
  //   6. (Optional) wire phase-licence dependencies — deferred to the
  //      Licences tab after creation.
  //
  // The conversion is reversible within 24h via `undoConversion` (see
  // ProjectsService). Department Manager is the actor.
  //
  // See docs/CORRECTED_CLIENT_JOURNEY.md §G "Won → 1-click project".

  async convertToProject(
    quoteId: string,
    dto: { title?: string; description?: string; startDate?: string } = {},
    actorId: string,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: { select: { id: true } },
        commercialConfirmation: true,
        purchaseOrder: { include: { project: true } },
        items: { select: { id: true, departmentId: true, description: true } },
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== QuoteStatus.WON) {
      throw new BadRequestException(
        'Only WON quotes can be converted to a project',
      );
    }
    if (quote.purchaseOrder?.project) {
      throw new BadRequestException(
        `A project already exists for this quote (${quote.purchaseOrder.project.projectNumber}).`,
      );
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const poNumber =
      quote.purchaseOrder?.poNumber ?? (await this.nextPoNumber());
    const projectNumber = await this.nextProjectNumber();

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark commercial confirmation as validated (if it exists).
      if (
        quote.commercialConfirmation &&
        quote.commercialConfirmation.validationStatus !==
          PaymentValidationStatus.VALIDATED
      ) {
        await tx.commercialConfirmation.update({
          where: { id: quote.commercialConfirmation.id },
          data: {
            validationStatus: PaymentValidationStatus.VALIDATED,
            validatedAt: new Date(),
            validatedById: actorId,
            validationNote:
              'Auto-validated as part of 1-click Convert to Project (2026-05-21).',
          },
        });
      }

      // 2. Mint the PO (or reuse existing).
      const po =
        quote.purchaseOrder ??
        (await tx.purchaseOrder.create({
          data: {
            poNumber,
            quoteId: quote.id,
            clientId: quote.clientId,
            contractValue: quote.totalAmount,
            status: POStatus.ACTIVE,
          },
        }));

      // 3. Bump client lifetimeValue.
      await tx.client.update({
        where: { id: quote.clientId },
        data: { lifetimeValue: { increment: quote.totalAmount } },
      });

      // 4. Create the Project with default phases.
      const project = await tx.project.create({
        data: {
          projectNumber,
          poId: po.id,
          clientId: quote.clientId,
          title: dto.title ?? quote.title,
          description: dto.description ?? quote.description ?? undefined,
          pmId: actorId,
          contractValue: quote.totalAmount,
          startDate,
          status: ProjectStatus.PLANNING,
          createdBy: actorId,
        },
      });

      let cursor = startDate;
      for (const t of DEFAULT_PHASE_TEMPLATE) {
        const plannedStart = new Date(cursor);
        const plannedEnd = new Date(cursor);
        plannedEnd.setDate(plannedEnd.getDate() + t.durationDays);
        await tx.phase.create({
          data: {
            projectId: project.id,
            name: t.name,
            phaseCode: t.phaseCode,
            position: t.position,
            ownerId: actorId,
            status: PhaseStatus.NOT_STARTED,
            plannedStart,
            plannedEnd,
            evidenceRequired: t.evidenceRequired,
          },
        });
        cursor = plannedEnd;
      }

      return project;
    });
  }
}
