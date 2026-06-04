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
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

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
}
