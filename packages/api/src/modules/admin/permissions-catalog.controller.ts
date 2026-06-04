import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RolesService } from './roles.service';

@ApiTags('admin-permissions')
@Controller('admin/permissions')
@RequirePermission('roles:view')
export class PermissionsCatalogController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Full permission catalog grouped by module' })
  catalog() {
    return this.roles.catalog();
  }
}
