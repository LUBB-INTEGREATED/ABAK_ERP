import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('users:view')
  @ApiOperation({ summary: 'List all users' })
  findAll() {
    return this.usersService.findAll();
  }

  // DATA-4: assign-to dropdown source. Gated on leads:view (the universal
  // operational permission a Sales Rep DOES have) — returns the caller's own
  // department teammates so the empty/403 dropdown is fixed without exposing the
  // whole-org PII list behind users:view.
  @Get('assignable')
  @RequirePermission('leads:view')
  @ApiOperation({
    summary: 'List users the caller may assign work to (own department)',
  })
  findAssignable(
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:view') scope: PermissionScope | undefined,
  ) {
    return this.usersService.findAssignable({
      id: user.id,
      departmentId: user.departmentId,
      scope,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }
}
