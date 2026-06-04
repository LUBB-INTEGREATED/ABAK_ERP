import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { AdminUsersService } from './admin-users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetRolesDto } from './dto/set-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('admin-users')
@Controller('admin/users')
@RequirePermission('users:view')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all employees with roles & department' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one employee' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Create an employee' })
  create(@Body() dto: CreateUserDto, @CurrentUser('id') actorId: string) {
    return this.service.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Update an employee (profile, status, department)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.update(id, dto, actorId);
  }

  @Put(':id/roles')
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Replace an employee’s role assignments' })
  setRoles(
    @Param('id') id: string,
    @Body() dto: SetRolesDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.setRoles(id, dto, actorId);
  }

  @Post(':id/reset-password')
  @RequirePermission('users:manage')
  @ApiOperation({ summary: 'Set a new password for an employee' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.resetPassword(id, dto, actorId);
  }
}
