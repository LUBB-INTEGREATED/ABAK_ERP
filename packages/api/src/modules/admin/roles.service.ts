import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Scope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../auth/permissions.service';
import {
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto';

const ROLE_INCLUDE = {
  permissions: {
    select: { scope: true, permission: { select: { key: true } } },
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.RoleInclude;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  /** Full permission catalog, grouped by module — drives the matrix UI. */
  async catalog() {
    const perms = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
      select: {
        key: true,
        module: true,
        action: true,
        description: true,
        scopeable: true,
      },
    });
    const groups = new Map<string, typeof perms>();
    for (const p of perms) {
      const list = groups.get(p.module) ?? [];
      list.push(p);
      groups.set(p.module, list);
    }
    return [...groups.entries()].map(([module, permissions]) => ({
      module,
      permissions,
    }));
  }

  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: ROLE_INCLUDE,
    });
    return roles.map(flattenRole);
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });
    if (!role) throw new NotFoundException('Role not found');
    return flattenRole(role);
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) throw new ConflictException('A role with that name exists');

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        description: dto.description,
        isSystem: false,
        isAssignable: true,
      },
      include: ROLE_INCLUDE,
    });
    await this.audit.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'Role',
      entityId: role.id,
      newValues: { name: role.name },
    });
    return flattenRole(role);
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    const current = await this.requireEditable(id);
    if (dto.name && dto.name !== current.name) {
      const clash = await this.prisma.role.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });
      if (clash) throw new ConflictException('A role with that name exists');
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        description: dto.description,
      },
      include: ROLE_INCLUDE,
    });
    await this.audit.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'Role',
      entityId: id,
      newValues: { name: role.name },
    });
    return flattenRole(role);
  }

  async setPermissions(
    id: string,
    dto: SetRolePermissionsDto,
    actorId: string,
  ) {
    await this.requireEditable(id);

    // Validate every key against the catalog and enforce scope sanity.
    const catalog = await this.prisma.permission.findMany({
      select: { id: true, key: true, scopeable: true },
    });
    const byKey = new Map(catalog.map((p) => [p.key, p]));

    const rows: { permissionId: string; scope: Scope }[] = [];
    const seen = new Set<string>();
    for (const entry of dto.permissions) {
      const perm = byKey.get(entry.key);
      if (!perm) {
        throw new BadRequestException(`Unknown permission: ${entry.key}`);
      }
      if (seen.has(entry.key)) {
        throw new BadRequestException(`Duplicate permission: ${entry.key}`);
      }
      seen.add(entry.key);
      // Non-scopeable (global) permissions only ever apply at ALL.
      const scope = perm.scopeable ? (entry.scope as Scope) : Scope.ALL;
      rows.push({ permissionId: perm.id, scope });
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      ...(rows.length
        ? [
            this.prisma.rolePermission.createMany({
              data: rows.map((r) => ({ roleId: id, ...r })),
            }),
          ]
        : []),
    ]);

    // A role's permission set affects every holder — clear the whole cache.
    this.permissions.invalidate();
    await this.audit.log({
      userId: actorId,
      action: 'SET_PERMISSIONS',
      entity: 'Role',
      entityId: id,
      newValues: {
        permissions: dto.permissions,
      } as unknown as Prisma.InputJsonValue,
    });

    return this.findOne(id);
  }

  async remove(id: string, actorId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }
    if (role._count.assignments > 0) {
      throw new ConflictException(
        'Role is assigned to users; unassign it first',
      );
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'Role',
      entityId: id,
      oldValues: { name: role.name },
    });
    return { message: 'Role deleted' };
  }

  private async requireEditable(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true, name: true, isSystem: true },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }
    return role;
  }
}

type RawRole = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

function flattenRole(role: RawRole) {
  const { permissions, _count, ...rest } = role;
  return {
    ...rest,
    assignmentCount: _count.assignments,
    permissions: permissions.map((p) => ({
      key: p.permission.key,
      scope: p.scope,
    })),
  };
}
