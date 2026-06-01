import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PermissionScope } from '../scope.util';

/**
 * Returns the resolved data-scope (OWN | DEPARTMENT | ALL) for a permission key,
 * as computed by PermissionGuard onto `request.permissionScopes`.
 *
 * Usage: `@CurrentScope('leads:view') scope: PermissionScope | undefined`
 */
export const CurrentScope = createParamDecorator(
  (
    permissionKey: string,
    ctx: ExecutionContext,
  ): PermissionScope | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.permissionScopes?.[permissionKey];
  },
);
