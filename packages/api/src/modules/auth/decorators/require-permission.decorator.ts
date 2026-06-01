import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Gate a route on one or more permission keys (e.g. 'users:view').
 * The user must hold ALL listed permissions. Data scope (own / department /
 * all) is resolved by PermissionGuard and applied in the service layer.
 *
 * Permission-based replacement for the legacy @Roles decorator.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
