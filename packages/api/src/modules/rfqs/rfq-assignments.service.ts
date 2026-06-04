import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RfqAssignmentStatus, RfqRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RfqsService } from './rfqs.service';
import type { ScopeContext } from '../auth/scope.util';

/**
 * Per-department pricer assignments on an RFQ + the related doc/site-visit
 * request streams. Added 2026-05-21 process correction.
 *
 * Lead Pricer constraint (enforced at this layer): across all rows of an
 * RFQ, exactly one assignment can have isLeadPricer = true. Toggling it
 * on one row automatically clears it from the others.
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §C "Assign the RFQ" and §D/E
 * "Price the work".
 */

export interface CreateAssignmentDto {
  departmentId: string;
  assigneeId: string;
  isLeadPricer?: boolean;
}

export interface UpdateAssignmentDto {
  assigneeId?: string;
  isLeadPricer?: boolean;
  status?: RfqAssignmentStatus;
  notes?: string;
}

export interface CreateDocRequestDto {
  description: string;
}

export interface UpdateDocRequestDto {
  response?: string;
  attachmentUrl?: string;
  status?: RfqRequestStatus;
}

export interface CreateSiteVisitRequestDto {
  purpose: string;
  preferredDateFrom?: string;
  preferredDateTo?: string;
}

export interface UpdateSiteVisitRequestDto {
  status?: RfqRequestStatus;
  scheduledAt?: string;
  completedAt?: string;
  notes?: string;
  // DM-13: access contact captured by the sales responder when scheduling.
  accessContactName?: string;
  accessContactPhone?: string;
}

@Injectable()
export class RfqAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rfqs: RfqsService,
  ) {}

  // ------------------------------------------------------------
  // Assignments
  // ------------------------------------------------------------

  async listAssignments(rfqId: string, scopeCtx?: ScopeContext) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    return this.prisma.rfqAssignment.findMany({
      where: { rfqId },
      include: {
        department: {
          select: { id: true, name: true, nameAr: true },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }

  async createAssignment(
    rfqId: string,
    dto: CreateAssignmentDto,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);

    return this.prisma.$transaction(async (tx) => {
      // D4 — Lead Pricer auto-rule: a single-service RFQ's sole assignee is the
      // Lead Pricer by default. The first assignment on an RFQ therefore becomes
      // the Lead Pricer unless the caller says otherwise; for multi-dept RFQs the
      // Sales Manager re-designates via updateAssignment (single-lead invariant).
      const existingCount = await tx.rfqAssignment.count({ where: { rfqId } });
      const isLeadPricer = dto.isLeadPricer ?? existingCount === 0;

      if (isLeadPricer) {
        await tx.rfqAssignment.updateMany({
          where: { rfqId },
          data: { isLeadPricer: false },
        });
      }
      try {
        const created = await tx.rfqAssignment.create({
          data: {
            rfqId,
            departmentId: dto.departmentId,
            assigneeId: dto.assigneeId,
            isLeadPricer,
          },
          include: {
            department: { select: { id: true, name: true, nameAr: true } },
          },
        });
        // DM-15c: keep the linked quote's section pricer/lead in lockstep with
        // the assignment (no-op until startPricing has minted the quote).
        await this.syncSectionFromAssignment(
          tx,
          rfqId,
          dto.departmentId,
          dto.assigneeId,
          isLeadPricer,
        );
        return created;
      } catch (err) {
        // DM-15b (RV2-2): @@unique([rfqId, departmentId]) — re-accepting an RFQ
        // that already has a section assigned is a 409, not an unhandled 500.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            'Department already assigned on this RFQ',
          );
        }
        throw err;
      }
    });
  }

  async updateAssignment(
    rfqId: string,
    assignmentId: string,
    dto: UpdateAssignmentDto,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    const existing = await this.prisma.rfqAssignment.findFirst({
      where: { id: assignmentId, rfqId },
    });
    if (!existing) throw new NotFoundException('Assignment not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isLeadPricer === true && !existing.isLeadPricer) {
        await tx.rfqAssignment.updateMany({
          where: { rfqId, NOT: { id: assignmentId } },
          data: { isLeadPricer: false },
        });
      }
      const data: Prisma.RfqAssignmentUpdateInput = {};
      if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
      if (dto.isLeadPricer !== undefined) data.isLeadPricer = dto.isLeadPricer;
      if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === RfqAssignmentStatus.SUBMITTED) {
          data.submittedAt = new Date();
        }
      }
      if (dto.notes !== undefined) data.notes = dto.notes;

      const updated = await tx.rfqAssignment.update({
        where: { id: assignmentId },
        data,
        include: {
          department: { select: { id: true, name: true, nameAr: true } },
        },
      });
      // DM-15c: re-assigning a pricer or moving the ⭐ Lead after pricing has
      // started must re-point the matching quote section too.
      await this.syncSectionFromAssignment(
        tx,
        rfqId,
        existing.departmentId,
        dto.assigneeId ?? existing.assigneeId,
        dto.isLeadPricer ?? existing.isLeadPricer,
      );
      return updated;
    });
  }

  /**
   * DM-15c: mirror an RfqAssignment onto its QuoteDepartmentSection once the
   * RFQ has a linked quote (post-startPricing). Sets the section's pricer and,
   * for a Lead, enforces the single-lead-per-quote invariant. A no-op while the
   * RFQ has no quote yet — startPricing seeds the sections from the assignments
   * at mint time instead. Section.departmentId and RfqAssignment.departmentId
   * share the ServiceCategory id space, so they join directly.
   */
  private async syncSectionFromAssignment(
    tx: Prisma.TransactionClient,
    rfqId: string,
    departmentId: string,
    pricerId: string,
    isLead: boolean,
  ) {
    const rfq = await tx.rfq.findUnique({
      where: { id: rfqId },
      select: { quoteId: true },
    });
    if (!rfq?.quoteId) return;
    const quoteId = rfq.quoteId;
    if (isLead) {
      await tx.quoteDepartmentSection.updateMany({
        where: { quoteId, departmentId: { not: departmentId } },
        data: { isLead: false },
      });
    }
    await tx.quoteDepartmentSection.updateMany({
      where: { quoteId, departmentId },
      data: { pricerId, isLead },
    });
  }

  async removeAssignment(
    rfqId: string,
    assignmentId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    const existing = await this.prisma.rfqAssignment.findFirst({
      where: { id: assignmentId, rfqId },
    });
    if (!existing) throw new NotFoundException('Assignment not found');
    if (existing.isLeadPricer) {
      throw new BadRequestException(
        'Cannot remove the Lead Pricer. Designate another assignee as Lead first.',
      );
    }
    return this.prisma.rfqAssignment.delete({ where: { id: assignmentId } });
  }

  /**
   * Check the Lead Pricer invariant for an RFQ. Returns the lead pricer's
   * assignment or null. The service consumer can use this to decide
   * whether the RFQ is ready to submit (must have exactly one).
   */
  async getLeadPricer(rfqId: string) {
    return this.prisma.rfqAssignment.findFirst({
      where: { rfqId, isLeadPricer: true },
      include: {
        department: { select: { id: true, name: true, nameAr: true } },
      },
    });
  }

  // ------------------------------------------------------------
  // Document requests (engineer → sales person)
  // ------------------------------------------------------------

  async listDocRequests(rfqId: string, scopeCtx?: ScopeContext) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    return this.prisma.rfqDocRequest.findMany({
      where: { rfqId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocRequest(
    rfqId: string,
    dto: CreateDocRequestDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    return this.prisma.rfqDocRequest.create({
      data: {
        rfqId,
        requestedById: actorId,
        description: dto.description,
      },
    });
  }

  async updateDocRequest(
    rfqId: string,
    requestId: string,
    dto: UpdateDocRequestDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    const existing = await this.prisma.rfqDocRequest.findFirst({
      where: { id: requestId, rfqId },
    });
    if (!existing) throw new NotFoundException('Doc request not found');

    const data: Prisma.RfqDocRequestUpdateInput = {};
    if (dto.response !== undefined) data.response = dto.response;
    if (dto.attachmentUrl !== undefined) data.attachmentUrl = dto.attachmentUrl;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === RfqRequestStatus.RESOLVED) {
        data.resolvedById = actorId;
        data.resolvedAt = new Date();
      }
    }
    return this.prisma.rfqDocRequest.update({
      where: { id: requestId },
      data,
    });
  }

  // ------------------------------------------------------------
  // Site visit requests
  // ------------------------------------------------------------

  async listSiteVisitRequests(rfqId: string, scopeCtx?: ScopeContext) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    return this.prisma.rfqSiteVisitRequest.findMany({
      where: { rfqId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSiteVisitRequest(
    rfqId: string,
    dto: CreateSiteVisitRequestDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    return this.prisma.rfqSiteVisitRequest.create({
      data: {
        rfqId,
        requestedById: actorId,
        purpose: dto.purpose,
        preferredDateFrom: dto.preferredDateFrom
          ? new Date(dto.preferredDateFrom)
          : null,
        preferredDateTo: dto.preferredDateTo
          ? new Date(dto.preferredDateTo)
          : null,
      },
    });
  }

  async updateSiteVisitRequest(
    rfqId: string,
    requestId: string,
    dto: UpdateSiteVisitRequestDto,
    scopeCtx?: ScopeContext,
  ) {
    await this.rfqs.assertCanAccess(rfqId, scopeCtx);
    const existing = await this.prisma.rfqSiteVisitRequest.findFirst({
      where: { id: requestId, rfqId },
    });
    if (!existing) throw new NotFoundException('Site visit request not found');

    const data: Prisma.RfqSiteVisitRequestUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.scheduledAt !== undefined)
      data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (dto.completedAt !== undefined)
      data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.accessContactName !== undefined)
      data.accessContactName = dto.accessContactName;
    if (dto.accessContactPhone !== undefined)
      data.accessContactPhone = dto.accessContactPhone;
    return this.prisma.rfqSiteVisitRequest.update({
      where: { id: requestId },
      data,
    });
  }
}
