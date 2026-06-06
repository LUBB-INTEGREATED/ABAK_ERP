import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  LinkDepartmentServiceDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

@ApiTags('admin-departments')
@Controller('admin/departments')
@RequirePermission('departments:view')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List departments with manager & counts' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one department' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('departments:manage')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto, @CurrentUser('id') actorId: string) {
    return this.service.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermission('departments:manage')
  @ApiOperation({
    summary: 'Update a department (incl. activate / set manager)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @RequirePermission('departments:manage')
  @ApiOperation({ summary: 'Delete an empty department' })
  remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.service.remove(id, actorId);
  }

  // CHAIN-1: ServiceCategory <-> Department links --------------------

  @Get(':id/services')
  @ApiOperation({
    summary: 'List the service categories linked to a department',
  })
  listServiceLinks(@Param('id') id: string) {
    return this.service.listServiceLinks(id);
  }

  @Post(':id/services')
  @RequirePermission('departments:manage')
  @ApiOperation({ summary: 'Link a service category to a department' })
  linkService(
    @Param('id') id: string,
    @Body() dto: LinkDepartmentServiceDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.linkService(id, dto.serviceCategoryId, actorId);
  }

  @Delete(':id/services/:serviceCategoryId')
  @RequirePermission('departments:manage')
  @ApiOperation({ summary: 'Unlink a service category from a department' })
  unlinkService(
    @Param('id') id: string,
    @Param('serviceCategoryId') serviceCategoryId: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.unlinkService(id, serviceCategoryId, actorId);
  }
}
