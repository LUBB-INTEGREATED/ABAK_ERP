import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import { DepartmentsService } from './departments.service';

/**
 * DM-15a (RV2-1): the dept-scoped member list that powers the Accept sheet's
 * pricer-picker. Deliberately NOT under the `admin/departments` class gate
 * (`departments:view`, which a Department Manager lacks) — it is gated by the
 * manager action `rfq:assign_pricers` instead, and object-level scoped in the
 * service so a manager can only list the department they manage.
 */
@ApiTags('departments')
@Controller('departments')
export class DepartmentMembersController {
  constructor(private readonly service: DepartmentsService) {}

  @Get(':departmentId/members')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({
    summary:
      "List a department's active members (+ manager) for the pricer-picker (manager-scoped).",
  })
  listMembers(
    @Param('departmentId') departmentId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:assign_pricers') scope: PermissionScope | undefined,
  ) {
    return this.service.listMembers(departmentId, { user, scope });
  }
}
