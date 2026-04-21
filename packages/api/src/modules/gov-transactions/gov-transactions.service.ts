import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GovTxStatus, Prisma } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateGovTransactionDto,
  ListGovTransactionsDto,
  LogCommentDto,
  LogVisitDto,
  RespondCommentDto,
  TransitionGovTxStatusDto,
  UpdateGovTransactionDto,
  UploadDocumentDto,
  WeeklyStatusUpdateDto,
} from './dto';

const DETAIL_INCLUDE = {
  project: { select: { id: true, projectNumber: true, title: true } },
  assignedPro: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  assignedEngineer: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  visits: {
    orderBy: { visitedAt: 'desc' as const },
    include: {
      visitedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  comments: {
    orderBy: { issuedAt: 'desc' as const },
    include: {
      respondedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
} satisfies Prisma.GovTransactionInclude;

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

@Injectable()
export class GovTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGovTransactionDto, actorId: string) {
    // BR-15 enforced at schema (projectId is required).
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const number = await this.generateNumber();
    return this.prisma.govTransaction.create({
      data: {
        transactionNumber: number,
        projectId: dto.projectId,
        authorityName: dto.authorityName,
        authorityCategory: dto.authorityCategory,
        transactionType: dto.transactionType,
        referenceNumber: dto.referenceNumber,
        assignedProId: dto.assignedProId,
        assignedEngineerId: dto.assignedEngineerId,
        expectedResponseAt: dto.expectedResponseAt
          ? new Date(dto.expectedResponseAt)
          : undefined,
        fees: dto.fees,
        status: GovTxStatus.DRAFT,
        createdBy: actorId,
      },
      include: DETAIL_INCLUDE,
    });
  }

  list(query: ListGovTransactionsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.GovTransactionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.authorityCategory
        ? { authorityCategory: query.authorityCategory }
        : {}),
      ...(query.assignedProId ? { assignedProId: query.assignedProId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                transactionNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                authorityName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                transactionType: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    return this.prisma
      .$transaction([
        this.prisma.govTransaction.count({ where }),
        this.prisma.govTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            project: {
              select: { id: true, projectNumber: true, title: true },
            },
            assignedPro: {
              select: { id: true, firstName: true, lastName: true },
            },
            _count: {
              select: { visits: true, comments: true, documents: true },
            },
          },
        }),
      ])
      .then(([total, data]) => ({
        data,
        pagination: {
          total,
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
        },
      }));
  }

  async findOne(id: string) {
    const tx = await this.prisma.govTransaction.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!tx) throw new NotFoundException();
    return tx;
  }

  async update(id: string, dto: UpdateGovTransactionDto) {
    await this.findOne(id);
    return this.prisma.govTransaction.update({
      where: { id },
      data: {
        authorityName: dto.authorityName,
        authorityCategory: dto.authorityCategory,
        transactionType: dto.transactionType,
        referenceNumber: dto.referenceNumber,
        assignedProId: dto.assignedProId,
        assignedEngineerId: dto.assignedEngineerId,
        expectedResponseAt: dto.expectedResponseAt
          ? new Date(dto.expectedResponseAt)
          : undefined,
        fees: dto.fees,
      },
      include: DETAIL_INCLUDE,
    });
  }

  // Lifecycle per doc PART 5: SUBMITTED → UNDER_REVIEW → (REVISION_REQUIRED
  // → SUBMITTED) → APPROVED. REJECTED/CANCELLED are terminal.
  async transitionStatus(id: string, dto: TransitionGovTxStatusDto) {
    const tx = await this.findOne(id);
    const next = dto.status;
    if (tx.status === next) return tx;

    if (
      tx.status === GovTxStatus.APPROVED ||
      tx.status === GovTxStatus.REJECTED ||
      tx.status === GovTxStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot transition out of a terminal status',
      );
    }

    const data: Prisma.GovTransactionUpdateInput = { status: next };
    if (next === GovTxStatus.SUBMITTED && !tx.submittedAt) {
      data.submittedAt = new Date();
    }
    if (next === GovTxStatus.APPROVED || next === GovTxStatus.REJECTED) {
      data.resolvedAt = new Date();
    }

    return this.prisma.govTransaction.update({
      where: { id },
      data,
      include: DETAIL_INCLUDE,
    });
  }

  // BR-16 — no PRO visit without same-day logging.
  async logVisit(id: string, dto: LogVisitDto, actorId: string) {
    await this.findOne(id);
    const visitedAt = new Date(dto.visitedAt);
    if (!sameCalendarDay(visitedAt, new Date())) {
      throw new BadRequestException(
        'Visits must be logged on the same calendar day they occurred (BR-16).',
      );
    }
    return this.prisma.govVisit.create({
      data: {
        transactionId: id,
        visitedById: actorId,
        visitedAt,
        purpose: dto.purpose,
        outcome: dto.outcome,
        nextAction: dto.nextAction,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  async logComment(id: string, dto: LogCommentDto) {
    await this.findOne(id);
    return this.prisma.govComment.create({
      data: {
        transactionId: id,
        commentText: dto.commentText,
        issuedAt: new Date(dto.issuedAt),
      },
    });
  }

  async respondToComment(
    commentId: string,
    dto: RespondCommentDto,
    actorId: string,
  ) {
    const comment = await this.prisma.govComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException();
    if (comment.respondedAt) {
      throw new BadRequestException('Comment already has a response');
    }
    return this.prisma.govComment.update({
      where: { id: commentId },
      data: {
        responseText: dto.responseText,
        respondedAt: new Date(),
        respondedById: actorId,
      },
    });
  }

  async uploadDocument(id: string, dto: UploadDocumentDto, actorId: string) {
    await this.findOne(id);
    return this.prisma.govDocument.create({
      data: {
        transactionId: id,
        title: dto.title,
        fileUrl: dto.fileUrl,
        mimeType: dto.mimeType,
        uploadedBy: actorId,
      },
    });
  }

  async weeklyStatusUpdate(id: string, _dto: WeeklyStatusUpdateDto) {
    return this.prisma.govTransaction.update({
      where: { id },
      data: { weeklyStatusLastAt: new Date() },
    });
  }

  // Stats used by the list/dashboard pages
  async stats() {
    const [total, byStatus, unloggedWeekly, awaitingResponse] =
      await this.prisma.$transaction([
        this.prisma.govTransaction.count(),
        this.prisma.govTransaction.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.govTransaction.count({
          where: {
            status: {
              in: [
                GovTxStatus.SUBMITTED,
                GovTxStatus.UNDER_REVIEW,
                GovTxStatus.REVISION_REQUIRED,
              ],
            },
            OR: [
              { weeklyStatusLastAt: null },
              {
                weeklyStatusLastAt: {
                  lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            ],
          },
        }),
        this.prisma.govComment.count({
          where: { respondedAt: null },
        }),
      ]);

    return {
      total,
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      unloggedWeekly,
      awaitingResponse,
    };
  }

  // PRO dashboard — my open transactions + my visits today
  async proDashboard(actorId: string) {
    const [open, visitsToday] = await this.prisma.$transaction([
      this.prisma.govTransaction.findMany({
        where: {
          assignedProId: actorId,
          status: {
            in: [
              GovTxStatus.SUBMITTED,
              GovTxStatus.UNDER_REVIEW,
              GovTxStatus.REVISION_REQUIRED,
            ],
          },
        },
        orderBy: { expectedResponseAt: 'asc' },
        include: {
          project: {
            select: { id: true, projectNumber: true, title: true },
          },
          _count: { select: { visits: true, comments: true } },
        },
      }),
      this.prisma.govVisit.findMany({
        where: {
          visitedById: actorId,
          visitedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        orderBy: { visitedAt: 'desc' },
        include: {
          transaction: {
            select: {
              id: true,
              transactionNumber: true,
              authorityName: true,
            },
          },
        },
      }),
    ]);

    return { open, visitsToday };
  }

  private async generateNumber() {
    const last = await this.prisma.govTransaction.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { transactionNumber: true },
    });
    return nextEntityNumber('GOV', last?.transactionNumber);
  }
}
