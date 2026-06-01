import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../permissions.service';

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
    const allowed = required.every((key) => map.has(key));
    if (!allowed) {
      throw new ForbiddenException('Missing required permission');
    }

    request.permissionScopes = Object.fromEntries(
      required.map((key) => [key, map.get(key)]),
    );
    return true;
  }
}
