import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LicenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Government licence tracking on a project.
 *
 * Added 2026-05-21 per the process correction. Replaces the standalone
 * GovTransaction model — government work is now licence applications
 * inside individual projects, owned by the Department Engineer assigned
 * to the relevant phase.
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §5 and flows/b3-licence-lifecycle.md.
 */

export interface CreateLicenceDto {
  name: string;
  portalName: string;
  portalUrl?: string;
  requestId?: string;
  appliedDate: string;
  notes?: string;
  reminderCadenceDays?: number;
  /** Phase IDs to wire as dependencies (hard-block phase start until issued). */
  blockedPhaseIds?: string[];
}

export interface UpdateLicenceDto {
  name?: string;
  portalName?: string;
  portalUrl?: string;
  requestId?: string;
  status?: LicenceStatus;
  appliedDate?: string;
  issuedDate?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  notes?: string;
  reminderCadenceDays?: number;
  blockedPhaseIds?: string[];
}

@Injectable()
export class LicencesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.licence.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { appliedDate: 'desc' },
      include: {
        blockedPhases: {
          select: { id: true, name: true, status: true },
        },
      },
    });
  }

  async create(projectId: string, dto: CreateLicenceDto, actorId: string) {
    await this.assertProjectExists(projectId);

    const licence = await this.prisma.licence.create({
      data: {
        projectId,
        name: dto.name,
        portalName: dto.portalName,
        portalUrl: dto.portalUrl,
        requestId: dto.requestId,
        appliedDate: new Date(dto.appliedDate),
        notes: dto.notes,
        appliedById: actorId,
        reminderCadenceDays: dto.reminderCadenceDays ?? 5,
        lastCheckedAt: new Date(),
        ...(dto.blockedPhaseIds && dto.blockedPhaseIds.length > 0
          ? {
              blockedPhases: {
                connect: dto.blockedPhaseIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        blockedPhases: { select: { id: true, name: true, status: true } },
      },
    });

    await this.recomputeProjectTimelineState(projectId);
    return licence;
  }

  async update(projectId: string, licenceId: string, dto: UpdateLicenceDto) {
    const existing = await this.prisma.licence.findFirst({
      where: { id: licenceId, projectId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Licence not found');

    const data: Prisma.LicenceUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.portalName !== undefined && { portalName: dto.portalName }),
      ...(dto.portalUrl !== undefined && { portalUrl: dto.portalUrl }),
      ...(dto.requestId !== undefined && { requestId: dto.requestId }),
      ...(dto.appliedDate !== undefined && {
        appliedDate: new Date(dto.appliedDate),
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.reminderCadenceDays !== undefined && {
        reminderCadenceDays: dto.reminderCadenceDays,
      }),
      lastCheckedAt: new Date(),
    };

    // Status transitions side-effects.
    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      if (dto.status === LicenceStatus.ISSUED) {
        data.issuedDate = dto.issuedDate
          ? new Date(dto.issuedDate)
          : new Date();
      }
      if (dto.status === LicenceStatus.REJECTED) {
        data.rejectedDate = dto.rejectedDate
          ? new Date(dto.rejectedDate)
          : new Date();
        if (!dto.rejectionReason) {
          throw new BadRequestException(
            'Rejection requires a rejectionReason.',
          );
        }
        data.rejectionReason = dto.rejectionReason;
      }
    } else {
      if (dto.issuedDate !== undefined) {
        data.issuedDate = dto.issuedDate ? new Date(dto.issuedDate) : null;
      }
      if (dto.rejectionReason !== undefined) {
        data.rejectionReason = dto.rejectionReason;
      }
    }

    if (dto.blockedPhaseIds !== undefined) {
      data.blockedPhases = {
        set: dto.blockedPhaseIds.map((id) => ({ id })),
      };
    }

    const licence = await this.prisma.licence.update({
      where: { id: licenceId },
      data,
      include: {
        blockedPhases: { select: { id: true, name: true, status: true } },
      },
    });

    await this.recomputeProjectTimelineState(projectId);
    return licence;
  }

  async softDelete(projectId: string, licenceId: string) {
    const existing = await this.prisma.licence.findFirst({
      where: { id: licenceId, projectId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Licence not found');

    const licence = await this.prisma.licence.update({
      where: { id: licenceId },
      data: { deletedAt: new Date() },
    });
    await this.recomputeProjectTimelineState(projectId);
    return licence;
  }

  /**
   * Should be called whenever a licence status changes or dependencies are
   * rewired. Looks at every non-issued blocking licence for every active
   * phase; if any phase is currently blocked by a non-issued licence, the
   * project enters PAUSED state. Otherwise ACTIVE.
   *
   * The pause-interval math (cumulative seconds paused) is best-effort:
   * when we transition from PAUSED → ACTIVE, we add the elapsed time
   * since the project was last marked PAUSED to `pausedSecondsTotal`.
   */
  async recomputeProjectTimelineState(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        timelineState: true,
        pausedSecondsTotal: true,
        updatedAt: true,
      },
    });
    if (!project) return;

    // A licence "blocks" if its status is NOT ISSUED and it has at least
    // one phase that hasn't been completed yet.
    const blockingLicenceCount = await this.prisma.licence.count({
      where: {
        projectId,
        deletedAt: null,
        status: { not: LicenceStatus.ISSUED },
        blockedPhases: {
          some: {
            status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED'] },
          },
        },
      },
    });

    const shouldPause = blockingLicenceCount > 0;
    if (shouldPause === (project.timelineState === 'PAUSED')) return;

    if (shouldPause) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { timelineState: 'PAUSED' },
      });
    } else {
      const pausedSince = project.updatedAt.getTime();
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - pausedSince) / 1000),
      );
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          timelineState: 'ACTIVE',
          pausedSecondsTotal: project.pausedSecondsTotal + elapsed,
        },
      });
    }
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
