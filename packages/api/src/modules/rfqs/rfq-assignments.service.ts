import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RfqAssignmentStatus, RfqRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
}

@Injectable()
export class RfqAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------
  // Assignments
  // ------------------------------------------------------------

  async listAssignments(rfqId: string) {
    await this.assertRfqExists(rfqId);
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

  async createAssignment(rfqId: string, dto: CreateAssignmentDto) {
    await this.assertRfqExists(rfqId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isLeadPricer) {
        await tx.rfqAssignment.updateMany({
          where: { rfqId },
          data: { isLeadPricer: false },
        });
      }
      return tx.rfqAssignment.create({
        data: {
          rfqId,
          departmentId: dto.departmentId,
          assigneeId: dto.assigneeId,
          isLeadPricer: dto.isLeadPricer ?? false,
        },
        include: {
          department: { select: { id: true, name: true, nameAr: true } },
        },
      });
    });
  }

  async updateAssignment(
    rfqId: string,
    assignmentId: string,
    dto: UpdateAssignmentDto,
  ) {
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

      return tx.rfqAssignment.update({
        where: { id: assignmentId },
        data,
        include: {
          department: { select: { id: true, name: true, nameAr: true } },
        },
      });
    });
  }

  async removeAssignment(rfqId: string, assignmentId: string) {
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

  async listDocRequests(rfqId: string) {
    await this.assertRfqExists(rfqId);
    return this.prisma.rfqDocRequest.findMany({
      where: { rfqId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocRequest(
    rfqId: string,
    dto: CreateDocRequestDto,
    actorId: string,
  ) {
    await this.assertRfqExists(rfqId);
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
  ) {
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

  async listSiteVisitRequests(rfqId: string) {
    await this.assertRfqExists(rfqId);
    return this.prisma.rfqSiteVisitRequest.findMany({
      where: { rfqId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSiteVisitRequest(
    rfqId: string,
    dto: CreateSiteVisitRequestDto,
    actorId: string,
  ) {
    await this.assertRfqExists(rfqId);
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
  ) {
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
    return this.prisma.rfqSiteVisitRequest.update({
      where: { id: requestId },
      data,
    });
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async assertRfqExists(rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { id: true },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
  }
}
