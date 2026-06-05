import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GovTxStatus, Prisma } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { isUnrestricted, type ScopeContext } from '../auth/scope.util';
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

  /**
   * Row-level scope `where` for gov transactions, or null when unrestricted
   * (ALL). Owner dimension is the assigned PRO / engineer plus the creator;
   * gov:* are scopeable and the schema carries assignedProId / assignedEngineerId
   * / createdBy. Single source of truth shared by list() and the object-level
   * guard so detail-read matches list visibility exactly.
   *
   * - DEPARTMENT manager: any tx assigned to a department member (as PRO or
   *   engineer) or created by one.
   * - OWN / DEPARTMENT non-manager: tx assigned to them or created by them.
   */
  private async govScopeWhere(
    scopeCtx?: ScopeContext,
  ): Promise<Prisma.GovTransactionWhereInput | null> {
    if (isUnrestricted(scopeCtx)) return null;
    const managedDeptId =
      scopeCtx!.scope === 'DEPARTMENT'
        ? scopeCtx!.user.managedDepartment?.id
        : undefined;
    if (managedDeptId) {
      const members = await this.prisma.user.findMany({
        where: { departmentId: managedDeptId },
        select: { id: true },
      });
      const memberIds = members.map((m) => m.id);
      return {
        OR: [
          { assignedProId: { in: memberIds } },
          { assignedEngineerId: { in: memberIds } },
          { createdBy: { in: memberIds } },
        ],
      };
    }
    const uid = scopeCtx!.user.id;
    return {
      OR: [
        { assignedProId: uid },
        { assignedEngineerId: uid },
        { createdBy: uid },
      ],
    };
  }

  /**
   * Object-level guard: the tx must be inside the actor's scope, else 403.
   * Pass the already-loaded tx existence-check upstream so a missing record
   * still surfaces as 404 from findOne.
   */
  private async assertGovInScope(id: string, scopeCtx?: ScopeContext) {
    const scopeWhere = await this.govScopeWhere(scopeCtx);
    if (!scopeWhere) return;
    const visible = await this.prisma.govTransaction.findFirst({
      where: { id, ...scopeWhere },
      select: { id: true },
    });
    if (!visible) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }

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

  async list(query: ListGovTransactionsDto, scopeCtx?: ScopeContext) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    // Row-level scope: a non-ALL actor only sees tx they're assigned to or
    // created (or their department's, for a manager). Wrapped under AND so it
    // composes with the search OR without colliding.
    const scopeWhere = await this.govScopeWhere(scopeCtx);
    const where: Prisma.GovTransactionWhereInput = {
      ...(scopeWhere ? { AND: [scopeWhere] } : {}),
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

  async findOne(id: string, scopeCtx?: ScopeContext) {
    const tx = await this.prisma.govTransaction.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!tx) throw new NotFoundException();
    // Object-level scope: re-check the list predicate so a non-ALL actor can't
    // read a tx outside their scope by id (cross-owner IDOR).
    await this.assertGovInScope(id, scopeCtx);
    return tx;
  }

  async update(
    id: string,
    dto: UpdateGovTransactionDto,
    scopeCtx?: ScopeContext,
  ) {
    await this.findOne(id, scopeCtx);
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
  async transitionStatus(
    id: string,
    dto: TransitionGovTxStatusDto,
    scopeCtx?: ScopeContext,
  ) {
    const tx = await this.findOne(id, scopeCtx);
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
  async logVisit(
    id: string,
    dto: LogVisitDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.findOne(id, scopeCtx);
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

  async logComment(id: string, dto: LogCommentDto, scopeCtx?: ScopeContext) {
    await this.findOne(id, scopeCtx);
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
    scopeCtx?: ScopeContext,
  ) {
    const comment = await this.prisma.govComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException();
    // Object-level scope on the parent tx so a non-ALL actor can't respond to a
    // comment of a tx outside their scope.
    await this.assertGovInScope(comment.transactionId, scopeCtx);
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

  async uploadDocument(
    id: string,
    dto: UploadDocumentDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    await this.findOne(id, scopeCtx);
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

  async weeklyStatusUpdate(
    id: string,
    _dto: WeeklyStatusUpdateDto,
    scopeCtx?: ScopeContext,
  ) {
    await this.findOne(id, scopeCtx);
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
          orderBy: { status: 'asc' },
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
        count: (r._count as { _all: number })._all,
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
