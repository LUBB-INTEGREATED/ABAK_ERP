import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhaseStatus, Prisma, ProjectStatus, TaskStatus } from '@prisma/client';
import { nextEntityNumber } from 'shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AdjustPhaseProgressDto,
  ClosureGateDto,
  CompletePhaseDto,
  CreateDependencyDto,
  CreatePhaseDto,
  CreateProjectDto,
  CreateTaskDto,
  ListProjectsDto,
  ReassignPhaseOwnerDto,
  TransitionProjectStatusDto,
  TransitionTaskStatusDto,
  UpdatePhaseDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './dto';
import { DEFAULT_PHASE_TEMPLATE } from './phase-template';
import {
  isUnrestricted,
  projectScopeFilter,
  type ScopeContext,
} from '../auth/scope.util';

const PROJECT_DETAIL_INCLUDE = {
  client: { select: { id: true, contactName: true, companyName: true } },
  po: {
    select: { id: true, poNumber: true, contractValue: true, status: true },
  },
  pm: { select: { id: true, firstName: true, lastName: true, email: true } },
  phases: {
    orderBy: { position: 'asc' as const },
    include: {
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      tasks: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          blockers: {
            include: {
              blocker: { select: { id: true, title: true, status: true } },
            },
          },
          dependents: {
            include: {
              dependent: { select: { id: true, title: true, status: true } },
            },
          },
        },
      },
    },
  },
  closureChecklist: true,
} satisfies Prisma.ProjectInclude;

type GateField =
  | 'allPhasesCompleted'
  | 'deliverablesSubmitted'
  | 'clientApprovalReceived'
  | 'finalPaymentReceived'
  | 'financeClearanceIssued';

const GATE_MAP: Record<ClosureGateDto['gate'], GateField> = {
  ALL_PHASES_COMPLETED: 'allPhasesCompleted',
  DELIVERABLES_SUBMITTED: 'deliverablesSubmitted',
  CLIENT_APPROVAL_RECEIVED: 'clientApprovalReceived',
  FINAL_PAYMENT_RECEIVED: 'finalPaymentReceived',
  FINANCE_CLEARANCE_ISSUED: 'financeClearanceIssued',
};

const PM_GATES = new Set<ClosureGateDto['gate']>([
  'ALL_PHASES_COMPLETED',
  'DELIVERABLES_SUBMITTED',
  'CLIENT_APPROVAL_RECEIVED',
]);

const FINANCE_GATES = new Set<ClosureGateDto['gate']>([
  'FINAL_PAYMENT_RECEIVED',
  'FINANCE_CLEARANCE_ISSUED',
]);

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Projects ------------------------------------------------------

  async create(dto: CreateProjectDto, actorId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.poId },
      include: { project: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.project) {
      throw new BadRequestException(
        'A project already exists for this purchase order',
      );
    }

    const pm = await this.prisma.user.findUnique({ where: { id: dto.pmId } });
    if (!pm) throw new NotFoundException('Project manager not found');

    const number = await this.generateProjectNumber();
    const start = dto.startDate ? new Date(dto.startDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          projectNumber: number,
          poId: po.id,
          clientId: po.clientId,
          title: dto.title,
          description: dto.description,
          pmId: dto.pmId,
          contractValue: po.contractValue,
          startDate: start,
          expectedEndDate: dto.expectedEndDate
            ? new Date(dto.expectedEndDate)
            : undefined,
          status: ProjectStatus.PLANNING,
          createdBy: actorId,
        },
      });

      if (!dto.skipDefaultPhases) {
        let cursor = start;
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
              ownerId: dto.pmId,
              status: PhaseStatus.NOT_STARTED,
              plannedStart,
              plannedEnd,
              evidenceRequired: t.evidenceRequired,
            },
          });
          cursor = plannedEnd;
        }
      }

      return tx.project.findUniqueOrThrow({
        where: { id: project.id },
        include: PROJECT_DETAIL_INCLUDE,
      });
    });
  }

  async list(query: ListProjectsDto, scopeCtx?: ScopeContext) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProjectWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.pmId ? { pmId: query.pmId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                projectNumber: { contains: query.search, mode: 'insensitive' },
              },
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                client: {
                  companyName: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    // Row-level scope: engineers see projects they are involved in (PM, phase
    // owner, or task assignee); ALL viewers (Technical Director/Exec/admin) are
    // unrestricted.
    const projectScope = projectScopeFilter(scopeCtx);
    if (Object.keys(projectScope).length) {
      where.AND = [projectScope as Prisma.ProjectWhereInput];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: {
          client: {
            select: { id: true, contactName: true, companyName: true },
          },
          pm: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { phases: true, tasks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string, scopeCtx?: ScopeContext) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: PROJECT_DETAIL_INCLUDE,
    });
    if (!project) throw new NotFoundException();
    await this.assertProjectInScope(id, scopeCtx);
    return project;
  }

  /**
   * Row-level object guard for detail-read and mutate-by-id. Projects are
   * relation-scoped (no owner column) so we re-run the list-style
   * `projectScopeFilter` against the single id: if the scoped query returns
   * nothing, the actor is not involved (PM / phase owner / task assignee /
   * dept) and gets a 403. No-op for ALL / absent scope.
   */
  private async assertProjectInScope(id: string, scopeCtx?: ScopeContext) {
    if (isUnrestricted(scopeCtx)) return;
    const ok = await this.prisma.project.findFirst({
      where: {
        id,
        ...(projectScopeFilter(scopeCtx) as Prisma.ProjectWhereInput),
      },
      select: { id: true },
    });
    if (!ok) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }
  }

  async update(id: string, dto: UpdateProjectDto, scopeCtx?: ScopeContext) {
    const project = await this.findOne(id, scopeCtx);
    this.assertWritable(project.status);
    const { poId: _poId, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: {
        title: rest.title,
        description: rest.description,
        pmId: rest.pmId,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        expectedEndDate: rest.expectedEndDate
          ? new Date(rest.expectedEndDate)
          : undefined,
      },
      include: PROJECT_DETAIL_INCLUDE,
    });
  }

  async transitionStatus(
    id: string,
    dto: TransitionProjectStatusDto,
    scopeCtx?: ScopeContext,
  ) {
    const project = await this.findOne(id, scopeCtx);
    const next = dto.status;

    if (project.status === next) return project;

    if (next === ProjectStatus.CLOSED) {
      throw new BadRequestException(
        'Use closure checklist to close a project (PART 7).',
      );
    }

    if (
      project.status === ProjectStatus.CLOSED ||
      project.status === ProjectStatus.CANCELLED
    ) {
      throw new ForbiddenException(
        'Cannot transition out of a terminal status',
      );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        status: next,
        actualEndDate:
          next === ProjectStatus.CLOSED || next === ProjectStatus.CANCELLED
            ? new Date()
            : null,
      },
      include: PROJECT_DETAIL_INCLUDE,
    });

    if (next === ProjectStatus.AT_RISK && project.pmId) {
      void this.notifications.send({
        recipientId: project.pmId,
        eventCode: 'project.at_risk',
        subject: `تنبيه: مشروع في خطر — ${project.projectNumber}`,
        body: `المشروع "${project.title}" تم تصنيفه كمشروع معرَّض للخطر`,
        deepLink: `/projects/${id}`,
        payload: { projectId: id, projectNumber: project.projectNumber },
      });
    }

    return updated;
  }

  // Phases --------------------------------------------------------

  async addPhase(
    projectId: string,
    dto: CreatePhaseDto,
    scopeCtx?: ScopeContext,
  ) {
    const project = await this.findOne(projectId, scopeCtx);
    this.assertWritable(project.status);
    const owner = await this.prisma.user.findUnique({
      where: { id: dto.ownerId },
    });
    if (!owner) throw new NotFoundException('Owner not found');
    return this.prisma.phase.create({
      data: {
        projectId,
        name: dto.name,
        phaseCode: dto.phaseCode,
        customLabel: dto.customLabel,
        position: dto.position,
        ownerId: dto.ownerId,
        plannedStart: new Date(dto.plannedStart),
        plannedEnd: new Date(dto.plannedEnd),
        evidenceRequired: dto.evidenceRequired ?? true,
      },
    });
  }

  async updatePhase(
    projectId: string,
    phaseId: string,
    dto: UpdatePhaseDto,
    scopeCtx?: ScopeContext,
  ) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException();
    const project = await this.findOne(projectId, scopeCtx);
    this.assertWritable(project.status);
    return this.prisma.phase.update({
      where: { id: phaseId },
      data: {
        name: dto.name,
        customLabel: dto.customLabel,
        position: dto.position,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        status: dto.status,
      },
    });
  }

  // BR-13: exactly one phase owner; reassignment requires a reason.
  async reassignPhaseOwner(
    projectId: string,
    phaseId: string,
    dto: ReassignPhaseOwnerDto,
    scopeCtx?: ScopeContext,
  ) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException();
    await this.assertProjectInScope(projectId, scopeCtx);
    const owner = await this.prisma.user.findUnique({
      where: { id: dto.ownerId },
    });
    if (!owner) throw new NotFoundException('Owner not found');
    if (phase.ownerId === dto.ownerId) {
      throw new BadRequestException('Phase is already owned by this user');
    }
    return this.prisma.phase.update({
      where: { id: phaseId },
      data: {
        ownerId: dto.ownerId,
        pmAdjustmentNote: `Owner changed. Reason: ${dto.reason}`,
      },
    });
  }

  // BR-14: phase cannot be marked complete without evidence.
  async completePhase(
    projectId: string,
    phaseId: string,
    dto: CompletePhaseDto,
    actorId: string,
    scopeCtx?: ScopeContext,
  ) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException();
    await this.assertProjectInScope(projectId, scopeCtx);
    if (phase.status === PhaseStatus.COMPLETED) {
      throw new BadRequestException('Phase already completed');
    }
    if (phase.evidenceRequired) {
      const hasEvidence =
        (dto.evidenceNote && dto.evidenceNote.trim().length >= 50) ||
        !!dto.clientAcknowledgedAt;
      if (!hasEvidence) {
        throw new BadRequestException(
          'Phase completion requires evidence: signed-off note (≥50 chars) or client acknowledgement (BR-14).',
        );
      }
    }
    const updated = await this.prisma.phase.update({
      where: { id: phaseId },
      data: {
        status: PhaseStatus.COMPLETED,
        completedAt: new Date(),
        completedById: actorId,
        actualEnd: new Date(),
        evidenceNote: dto.evidenceNote,
        clientAcknowledgedAt: dto.clientAcknowledgedAt
          ? new Date(dto.clientAcknowledgedAt)
          : undefined,
        progressPct: 100,
      },
    });
    await this.recomputeProjectProgress(projectId);
    return updated;
  }

  // M5-007 — PM manual adjustment
  async adjustPhaseProgress(
    projectId: string,
    phaseId: string,
    dto: AdjustPhaseProgressDto,
    scopeCtx?: ScopeContext,
  ) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException();
    await this.assertProjectInScope(projectId, scopeCtx);
    const updated = await this.prisma.phase.update({
      where: { id: phaseId },
      data: {
        pmAdjustment: dto.progressPct,
        pmAdjustmentNote: dto.reason,
        progressPct: dto.progressPct,
      },
    });
    await this.recomputeProjectProgress(projectId);
    return updated;
  }

  // Tasks ---------------------------------------------------------

  async addTask(
    projectId: string,
    phaseId: string,
    dto: CreateTaskDto,
    scopeCtx?: ScopeContext,
  ) {
    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException();
    await this.assertProjectInScope(projectId, scopeCtx);
    return this.prisma.task.create({
      data: {
        projectId,
        phaseId,
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        priority: dto.priority,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        estimatedHours: dto.estimatedHours,
      },
    });
  }

  async updateTask(
    taskId: string,
    dto: UpdateTaskDto,
    scopeCtx?: ScopeContext,
  ) {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!existing) throw new NotFoundException();
    await this.assertProjectInScope(existing.projectId, scopeCtx);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        priority: dto.priority,
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : undefined,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : undefined,
        estimatedHours: dto.estimatedHours,
      },
    });
  }

  async transitionTaskStatus(
    taskId: string,
    dto: TransitionTaskStatusDto,
    scopeCtx?: ScopeContext,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { blockers: { include: { blocker: true } } },
    });
    if (!task) throw new NotFoundException();
    await this.assertProjectInScope(task.projectId, scopeCtx);

    // Dependency gate: dependent task can't start unless every blocker is DONE.
    if (
      dto.status === TaskStatus.IN_PROGRESS &&
      task.blockers.some((b) => b.blocker.status !== TaskStatus.DONE)
    ) {
      throw new BadRequestException(
        'Cannot start task while blockers are not DONE.',
      );
    }

    const patch: Prisma.TaskUpdateInput = { status: dto.status };
    if (dto.status === TaskStatus.IN_PROGRESS && !task.actualStart) {
      patch.actualStart = new Date();
    }
    if (dto.status === TaskStatus.DONE) {
      patch.actualEnd = new Date();
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: patch,
    });
    await this.recomputePhaseProgress(task.phaseId);
    return updated;
  }

  async addDependency(
    taskId: string,
    dto: CreateDependencyDto,
    scopeCtx?: ScopeContext,
  ) {
    if (taskId === dto.blockerTaskId) {
      throw new BadRequestException('Task cannot depend on itself');
    }
    const [dependent, blocker] = await Promise.all([
      this.prisma.task.findUnique({ where: { id: taskId } }),
      this.prisma.task.findUnique({ where: { id: dto.blockerTaskId } }),
    ]);
    if (!dependent || !blocker) throw new NotFoundException();
    await this.assertProjectInScope(dependent.projectId, scopeCtx);

    // Cycle check: walk from blocker backwards through its blockers; reject
    // if taskId appears in the chain.
    const visited = new Set<string>();
    const stack = [dto.blockerTaskId];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === taskId) {
        throw new BadRequestException(
          'Creating this dependency would introduce a cycle',
        );
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const deps = await this.prisma.taskDependency.findMany({
        where: { dependentId: current },
        select: { blockerId: true },
      });
      stack.push(...deps.map((d) => d.blockerId));
    }

    return this.prisma.taskDependency.create({
      data: { dependentId: taskId, blockerId: dto.blockerTaskId },
    });
  }

  async removeDependency(
    taskId: string,
    blockerTaskId: string,
    scopeCtx?: ScopeContext,
  ) {
    if (!isUnrestricted(scopeCtx)) {
      const dependent = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      });
      if (!dependent) throw new NotFoundException();
      await this.assertProjectInScope(dependent.projectId, scopeCtx);
    }
    await this.prisma.taskDependency.delete({
      where: {
        dependentId_blockerId: {
          dependentId: taskId,
          blockerId: blockerTaskId,
        },
      },
    });
    return { ok: true };
  }

  // Closure (PART 7) ----------------------------------------------

  async initiateClosure(id: string, actorId: string, scopeCtx?: ScopeContext) {
    const project = await this.findOne(id, scopeCtx);
    if (project.status === ProjectStatus.CLOSED) {
      throw new BadRequestException('Project is already closed');
    }
    if (project.status === ProjectStatus.CANCELLED) {
      throw new BadRequestException('Cannot close a cancelled project');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: { status: ProjectStatus.CLOSING },
      });
      const existing = await tx.closureChecklist.findUnique({
        where: { projectId: id },
      });
      const checklist = existing
        ? existing
        : await tx.closureChecklist.create({
            data: {
              projectId: id,
              initiatedById: actorId,
            },
          });
      return checklist;
    });
  }

  async setClosureGate(
    projectId: string,
    dto: ClosureGateDto,
    actor: { id: string; role: string },
    scopeCtx?: ScopeContext,
  ) {
    await this.assertProjectInScope(projectId, scopeCtx);
    if (PM_GATES.has(dto.gate) && !this.isPmOrAdmin(actor.role)) {
      throw new ForbiddenException('Only PM / Admin can flip PM gates');
    }
    if (FINANCE_GATES.has(dto.gate) && !this.isFinanceOrAdmin(actor.role)) {
      throw new ForbiddenException(
        'Only Finance / Admin can flip Finance gates',
      );
    }

    const field = GATE_MAP[dto.gate];
    const atField = `${field}At` as `${GateField}At`;
    const byField = `${field}ById` as `${GateField}ById`;

    const checklist = await this.prisma.closureChecklist.findUnique({
      where: { projectId },
    });
    if (!checklist)
      throw new NotFoundException('Closure checklist not initiated');

    const updated = await this.prisma.closureChecklist.update({
      where: { projectId },
      data: {
        [field]: dto.value,
        [atField]: dto.value ? new Date() : null,
        [byField]: dto.value ? actor.id : null,
      } as Prisma.ClosureChecklistUpdateInput,
    });

    const allPassed =
      updated.allPhasesCompleted &&
      updated.deliverablesSubmitted &&
      updated.clientApprovalReceived &&
      updated.finalPaymentReceived &&
      updated.financeClearanceIssued;

    if (allPassed) {
      await this.prisma.$transaction([
        this.prisma.project.update({
          where: { id: projectId },
          data: {
            status: ProjectStatus.CLOSED,
            actualEndDate: new Date(),
          },
        }),
        this.prisma.closureChecklist.update({
          where: { projectId },
          data: { closedAt: new Date() },
        }),
      ]);
    }

    return this.prisma.closureChecklist.findUnique({
      where: { projectId },
    });
  }

  async listAvailablePurchaseOrders() {
    return this.prisma.purchaseOrder.findMany({
      where: { project: null, status: { in: ['ACTIVE'] } },
      orderBy: { poDate: 'desc' },
      select: {
        id: true,
        poNumber: true,
        contractValue: true,
        poDate: true,
        client: {
          select: { id: true, contactName: true, companyName: true },
        },
        quote: {
          select: { id: true, quoteNumber: true, title: true },
        },
      },
    });
  }

  async listEligiblePms() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: {
          in: ['SUPER_ADMIN', 'ADMIN', 'TECHNICAL_MANAGER', 'SALES_MANAGER'],
        },
      },
      orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
  }

  async getResourceWorkload() {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.NOT_STARTED] },
        assigneeId: { not: null },
        project: {
          status: { in: [ProjectStatus.ACTIVE, ProjectStatus.AT_RISK] },
        },
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    const map = new Map<
      string,
      {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        role: string;
        activeTasks: number;
        totalPlannedHours: number;
      }
    >();

    for (const task of tasks) {
      if (!task.assignee) continue;
      const key = task.assigneeId!;
      if (!map.has(key)) {
        map.set(key, {
          userId: task.assignee.id,
          firstName: task.assignee.firstName,
          lastName: task.assignee.lastName,
          role: task.assignee.role,
          activeTasks: 0,
          totalPlannedHours: 0,
        });
      }
      const u = map.get(key)!;
      u.activeTasks++;
      u.totalPlannedHours +=
        (task as { estimatedHours?: number | null }).estimatedHours ?? 0;
    }

    return Array.from(map.values()).map((u) => ({
      ...u,
      utilizationStatus:
        u.activeTasks <= 3
          ? 'AVAILABLE'
          : u.activeTasks <= 7
            ? 'BUSY'
            : 'OVERLOADED',
    }));
  }

  async stats() {
    const [total, byStatus, atRisk] = await this.prisma.$transaction([
      this.prisma.project.count(),
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.project.count({ where: { financialRiskFlagged: true } }),
    ]);
    return {
      total,
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      atRisk,
    };
  }

  // ---------------------------------------------------------------

  private assertWritable(status: ProjectStatus) {
    if (status === ProjectStatus.CLOSED) {
      throw new ForbiddenException('Project is CLOSED and read-only (PART 7).');
    }
    if (status === ProjectStatus.CANCELLED) {
      throw new ForbiddenException('Project is CANCELLED.');
    }
  }

  private isPmOrAdmin(role: string): boolean {
    return (
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'TECHNICAL_MANAGER' ||
      role === 'SALES_MANAGER'
    );
  }

  private isFinanceOrAdmin(role: string): boolean {
    return (
      role === 'FINANCE_MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN'
    );
  }

  private async recomputePhaseProgress(phaseId: string) {
    const phase = await this.prisma.phase.findUnique({
      where: { id: phaseId },
      include: { tasks: true },
    });
    if (!phase) return;
    // If PM has manually adjusted, respect their override until they clear it.
    if (phase.pmAdjustment != null) return;
    const total = phase.tasks.length;
    const done = phase.tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
    await this.prisma.phase.update({
      where: { id: phaseId },
      data: { progressPct: pct },
    });
    await this.recomputeProjectProgress(phase.projectId);
  }

  private async recomputeProjectProgress(projectId: string) {
    const phases = await this.prisma.phase.findMany({
      where: { projectId },
    });
    if (phases.length === 0) return;

    // Weighted by planned duration (days)
    const weighted = phases.reduce(
      (acc, p) => {
        const duration = Math.max(
          1,
          Math.round(
            (p.plannedEnd.getTime() - p.plannedStart.getTime()) / 86_400_000,
          ),
        );
        return {
          num: acc.num + (p.progressPct ?? 0) * duration,
          den: acc.den + duration,
        };
      },
      { num: 0, den: 0 },
    );
    const pct =
      weighted.den === 0
        ? 0
        : Math.round((weighted.num / weighted.den) * 10) / 10;
    await this.prisma.project.update({
      where: { id: projectId },
      data: { actualProgress: pct },
    });
  }

  private async generateProjectNumber(): Promise<string> {
    const last = await this.prisma.project.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { projectNumber: true },
    });
    return nextEntityNumber('PRJ', last?.projectNumber);
  }
}
