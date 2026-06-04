import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import {
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

@ApiTags('admin-roles')
@Controller('admin/roles')
@RequirePermission('roles:view')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles with their permissions' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one role' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('roles:manage')
  @ApiOperation({ summary: 'Create a custom role' })
  create(@Body() dto: CreateRoleDto, @CurrentUser('id') actorId: string) {
    return this.service.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermission('roles:manage')
  @ApiOperation({ summary: 'Rename / re-describe a role' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.update(id, dto, actorId);
  }

  @Put(':id/permissions')
  @RequirePermission('roles:manage')
  @ApiOperation({ summary: 'Replace a role’s permission set (key + scope)' })
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.setPermissions(id, dto, actorId);
  }

  @Delete(':id')
  @RequirePermission('roles:manage')
  @ApiOperation({ summary: 'Delete an unused custom role' })
  remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.service.remove(id, actorId);
  }
}
