import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../auth/permissions.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetRolesDto } from './dto/set-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  department: { select: { id: true, name: true, nameAr: true } },
  roleAssignments: {
    select: { role: { select: { id: true, name: true, nameAr: true } } },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({
      select: LIST_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return users.map(flattenUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...LIST_SELECT, managedDepartment: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return flattenUser(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email already registered');

    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (dto.roleIds?.length) await this.assertRolesExist(dto.roleIds);

    const rounds = this.config.get<number>('auth.bcryptRounds') ?? 10;
    const hashed = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: (dto.status as UserStatus) ?? UserStatus.ACTIVE,
        role: (dto.legacyRole as UserRole) ?? UserRole.VIEWER,
        departmentId: dto.departmentId,
        roleAssignments: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: LIST_SELECT,
    });

    await this.audit.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      newValues: { email: dto.email, roleIds: dto.roleIds ?? [] },
    });

    return flattenUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true, role: true, departmentId: true },
    });
    if (!current) throw new NotFoundException('User not found');

    if (id === actorId && dto.status && dto.status !== 'ACTIVE') {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: dto.status as UserStatus | undefined,
        role: dto.legacyRole as UserRole | undefined,
        // null clears the FK; undefined leaves it untouched.
        departmentId:
          dto.departmentId === undefined ? undefined : dto.departmentId,
      },
      select: LIST_SELECT,
    });

    // A deactivated / suspended user must lose live sessions immediately.
    if (dto.status && dto.status !== 'ACTIVE') {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }
    this.permissions.invalidate(id);

    await this.audit.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      oldValues: { status: current.status, role: current.role },
      newValues: { status: user.status, role: user.role },
    });

    return flattenUser(user);
  }

  async setRoles(id: string, dto: SetRolesDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (dto.roleIds.length) await this.assertRolesExist(dto.roleIds);

    await this.prisma.$transaction([
      this.prisma.roleAssignment.deleteMany({ where: { userId: id } }),
      ...(dto.roleIds.length
        ? [
            this.prisma.roleAssignment.createMany({
              data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
            }),
          ]
        : []),
    ]);

    this.permissions.invalidate(id);
    await this.audit.log({
      userId: actorId,
      action: 'SET_ROLES',
      entity: 'User',
      entityId: id,
      newValues: { roleIds: dto.roleIds },
    });

    return this.findOne(id);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const rounds = this.config.get<number>('auth.bcryptRounds') ?? 10;
    const hashed = await bcrypt.hash(dto.password, rounds);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
    // Force re-login everywhere with the new credential.
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    await this.audit.log({
      userId: actorId,
      action: 'RESET_PASSWORD',
      entity: 'User',
      entityId: id,
    });

    return { message: 'Password reset successfully' };
  }

  private async assertDepartmentExists(departmentId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!dept) throw new BadRequestException('Department not found');
  }

  private async assertRolesExist(roleIds: string[]) {
    const count = await this.prisma.role.count({
      where: { id: { in: roleIds } },
    });
    if (count !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }
  }
}

type RawUser = Prisma.UserGetPayload<{ select: typeof LIST_SELECT }> & {
  managedDepartment?: { id: string } | null;
};

function flattenUser(user: RawUser) {
  const { roleAssignments, managedDepartment, ...rest } = user;
  return {
    ...rest,
    roles: roleAssignments.map((a) => a.role),
    managesDepartmentId: managedDepartment?.id ?? null,
  };
}
