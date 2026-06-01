import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type PermissionScope = 'OWN' | 'DEPARTMENT' | 'ALL';

const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 1,
  DEPARTMENT: 2,
  ALL: 3,
};

interface CachedPermissions {
  map: Map<string, PermissionScope>;
  expiresAt: number;
}

/**
 * Resolves a user's effective permissions = the union of every role they
 * hold. When two roles grant the same permission at different scopes, the
 * widest scope wins (ALL > DEPARTMENT > OWN). Cached briefly so we don't hit
 * the DB on every request; call invalidate() after a role change.
 */
@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, CachedPermissions>();
  private readonly ttlMs = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(userId: string): Promise<Map<string, PermissionScope>> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.map;
    }

    const assignments = await this.prisma.roleAssignment.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            permissions: {
              select: {
                scope: true,
                permission: { select: { key: true } },
              },
            },
          },
        },
      },
    });

    const map = new Map<string, PermissionScope>();
    for (const assignment of assignments) {
      for (const rp of assignment.role.permissions) {
        const key = rp.permission.key;
        const scope = rp.scope as PermissionScope;
        const current = map.get(key);
        if (!current || SCOPE_RANK[scope] > SCOPE_RANK[current]) {
          map.set(key, scope);
        }
      }
    }

    this.cache.set(userId, { map, expiresAt: Date.now() + this.ttlMs });
    return map;
  }

  async hasAll(userId: string, keys: string[]): Promise<boolean> {
    if (keys.length === 0) return true;
    const map = await this.resolveForUser(userId);
    return keys.every((key) => map.has(key));
  }

  /** Drop cached permissions so the next request re-resolves from the DB. */
  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}
