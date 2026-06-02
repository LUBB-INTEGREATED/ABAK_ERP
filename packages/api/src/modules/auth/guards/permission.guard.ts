import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import {
  PermissionsService,
  type PermissionScope,
} from '../permissions.service';

/**
 * Manager-designation actions (RBAC design §5.4). These are NOT granted via a
 * role for an ordinary department manager — they are unlocked for the engineer
 * where `Department.managerId == user.id` (i.e. the user has a managedDepartment).
 * Promoting a manager stays a one-field change, no role edit. A manager exercises
 * these at DEPARTMENT scope.
 */
const MANAGER_ACTION_KEYS = new Set<string>([
  'rfq:assign_pricers',
  'rfq:set_lead_pricer',
  'project:convert',
]);

/**
 * Global guard, runs after JwtAuthGuard. Routes without @RequirePermission
 * pass straight through (still authenticated). For gated routes it checks the
 * user's effective permission set, and exposes the resolved scope per key on
 * `request.permissionScopes` so the service layer can filter records
 * (own / department / all).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) return false;

    const map = await this.permissions.resolveForUser(user.id);
    const isManager = Boolean(user.managedDepartment?.id);

    // Resolve an effective scope per required key. A key is satisfied either by
    // the user's role-granted permissions, or — for manager-designation actions
    // — by the manager hat (Department.managerId), exercised at DEPARTMENT scope.
    const scopes: Record<string, PermissionScope | undefined> = {};
    for (const key of required) {
      if (map.has(key)) {
        scopes[key] = map.get(key);
        continue;
      }
      if (isManager && MANAGER_ACTION_KEYS.has(key)) {
        // Widest of the manager grant (DEPARTMENT) and any role grant (none here).
        scopes[key] = 'DEPARTMENT';
        continue;
      }
      throw new ForbiddenException('Missing required permission');
    }

    request.permissionScopes = scopes;
    return true;
  }
}
