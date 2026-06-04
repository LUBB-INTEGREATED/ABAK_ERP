import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeptType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isUnrestricted, type ScopeContext } from '../auth/scope.util';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

const DEPT_INCLUDE = {
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  _count: { select: { members: true, services: true } },
} satisfies Prisma.DepartmentInclude;

// Minimal user shape the pricer-picker needs (DM-15a).
const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const depts = await this.prisma.department.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: DEPT_INCLUDE,
    });
    return depts.map(flattenDept);
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: DEPT_INCLUDE,
    });
    if (!dept) throw new NotFoundException('Department not found');
    return flattenDept(dept);
  }

  async create(dto: CreateDepartmentDto, actorId: string) {
    const existing = await this.prisma.department.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('A department with that name exists');

    const dept = await this.prisma.department.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        type: dto.type as DeptType,
        order: dto.order ?? 0,
      },
      include: DEPT_INCLUDE,
    });
    await this.audit.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'Department',
      entityId: dept.id,
      newValues: { name: dept.name },
    });
    return flattenDept(dept);
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId: string) {
    const current = await this.prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!current) throw new NotFoundException('Department not found');

    if (dto.name && dto.name !== current.name) {
      const clash = await this.prisma.department.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });
      if (clash)
        throw new ConflictException('A department with that name exists');
    }
    if (dto.managerId) await this.assertManagerEligible(dto.managerId, id);

    const dept = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        type: dto.type as DeptType | undefined,
        isActive: dto.isActive,
        order: dto.order,
        managerId: dto.managerId === undefined ? undefined : dto.managerId,
      },
      include: DEPT_INCLUDE,
    });
    await this.audit.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'Department',
      entityId: id,
      newValues: { name: dept.name, isActive: dept.isActive },
    });
    return flattenDept(dept);
  }

  async remove(id: string, actorId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept._count.members > 0) {
      throw new ConflictException(
        'Department has members; reassign them or deactivate instead',
      );
    }
    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'Department',
      entityId: id,
      oldValues: { name: dept.name },
    });
    return { message: 'Department deleted' };
  }

  /**
   * DM-15a (RV2-1): list a department's active members (+ its manager) for the
   * Accept sheet's pricer-picker — a dept-scoped read that does NOT need the
   * broad `users:view` grant a Department Manager lacks. The route guard
   * already requires `rfq:assign_pricers` (a sales rep is refused there); this
   * adds the object-level rule: an ALL-scoped caller (Technical Director /
   * admin) may list any department, while a DEPARTMENT/OWN-scoped manager may
   * only list members of the one department they manage.
   *
   * Grain note: `departmentId` here is a real `Department` id. The web Accept
   * sheet folds the section's `ServiceCategory` → owning Department via
   * `DepartmentService` before calling this (see DM-15 report).
   */
  async listMembers(departmentId: string, scopeCtx?: ScopeContext) {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        manager: { select: MEMBER_SELECT },
        members: {
          where: { status: 'ACTIVE' },
          select: MEMBER_SELECT,
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');

    if (
      !isUnrestricted(scopeCtx) &&
      scopeCtx!.user.managedDepartment?.id !== departmentId
    ) {
      throw new ForbiddenException(
        'You may only list members of a department you manage',
      );
    }

    // The manager is one of the department's own engineers; merge + dedupe so
    // they appear once, flagged. Members already filtered to ACTIVE.
    const byId = new Map<
      string,
      Prisma.UserGetPayload<{ select: typeof MEMBER_SELECT }> & {
        isManager: boolean;
      }
    >();
    for (const m of dept.members) byId.set(m.id, { ...m, isManager: false });
    if (dept.manager)
      byId.set(dept.manager.id, { ...dept.manager, isManager: true });
    return Array.from(byId.values());
  }

  /**
   * The manager must be one of this department's own members and must not
   * already manage a different department (schema enforces @unique managerId).
   */
  private async assertManagerEligible(userId: string, deptId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        departmentId: true,
        managedDepartment: { select: { id: true } },
      },
    });
    if (!user) throw new BadRequestException('Manager user not found');
    if (user.departmentId !== deptId) {
      throw new BadRequestException(
        'Manager must be a member of this department',
      );
    }
    if (user.managedDepartment && user.managedDepartment.id !== deptId) {
      throw new ConflictException('User already manages another department');
    }
  }
}

type RawDept = Prisma.DepartmentGetPayload<{ include: typeof DEPT_INCLUDE }>;

function flattenDept(dept: RawDept) {
  const { _count, ...rest } = dept;
  return {
    ...rest,
    memberCount: _count.members,
    serviceCount: _count.services,
  };
}
