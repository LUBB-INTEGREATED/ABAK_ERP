import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  status: true,
  preferredLanguage: true,
  calendarDisplay: true,
  numeralSystem: true,
  timezone: true,
  notificationQuietHoursStart: true,
  notificationQuietHoursEnd: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      message: 'Users retrieved successfully',
      count: users.length,
      users,
    };
  }

  /**
   * DATA-4: a minimal, scoped "who can I assign to?" list for the assign-to
   * dropdowns (leads/clients/RFQ). A Sales Rep lacks `users:view` (so GET /users
   * 403s + the dropdown was empty + console "API Error"); this returns only the
   * active members of the caller's own department (plus the caller), with only
   * the id/name/role needed to render a picker — no PII enumeration of the whole
   * org. An ALL-scoped caller gets every active user.
   */
  async findAssignable(actor: {
    id: string;
    departmentId?: string | null;
    scope?: 'OWN' | 'DEPARTMENT' | 'ALL';
  }) {
    const unrestricted = !actor.scope || actor.scope === 'ALL';
    const where = unrestricted
      ? { status: 'ACTIVE' as const }
      : {
          status: 'ACTIVE' as const,
          // Own department teammates (+ the caller, who is in it). When the
          // caller has no department, fall back to just themselves.
          OR: actor.departmentId
            ? [{ departmentId: actor.departmentId }, { id: actor.id }]
            : [{ id: actor.id }],
        };
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return { count: users.length, users };
  }

  async findMe(userId: string) {
    const [profile, permissionMap] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: PROFILE_SELECT,
      }),
      this.permissions.resolveForUser(userId),
    ]);
    // Effective permission keys (+ scope) = union of every role held. Drives
    // permission-based gating in the web client.
    const permissions = [...permissionMap.entries()].map(([key, scope]) => ({
      key,
      scope,
    }));
    return { ...profile, permissions };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PROFILE_SELECT,
    });
  }
}
