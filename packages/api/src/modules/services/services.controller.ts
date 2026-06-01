import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import {
  CreateServiceCategoryDto,
  CreateServiceDto,
  UpdateServiceCategoryDto,
  UpdateServiceDto,
} from './dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth('JWT-auth')
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get('services')
  @ApiOperation({
    summary:
      'List services with their category (add ?includeInactive=true for admin views)',
  })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.services.findAll(includeInactive === 'true');
  }

  @Get('services/:id')
  @ApiOperation({ summary: 'Fetch a service by id' })
  findOne(@Param('id') id: string) {
    return this.services.findOne(id);
  }

  @Post('services')
  @RequirePermission('services:manage')
  @ApiOperation({ summary: 'Create a service (admin only)' })
  create(@Body() dto: CreateServiceDto) {
    return this.services.create(dto);
  }

  @Patch('services/:id')
  @RequirePermission('services:manage')
  @ApiOperation({ summary: 'Update a service (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }

  @Delete('services/:id')
  @RequirePermission('services:manage')
  @ApiOperation({ summary: 'Deactivate a service (admin only)' })
  deactivate(@Param('id') id: string) {
    return this.services.deactivate(id);
  }

  @Get('service-categories')
  @ApiOperation({ summary: 'List service categories' })
  findCategories(@Query('includeInactive') includeInactive?: string) {
    return this.services.findCategories(includeInactive === 'true');
  }

  @Post('service-categories')
  @RequirePermission('services:manage')
  @ApiOperation({ summary: 'Create a category (admin only)' })
  createCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.services.createCategory(dto);
  }

  @Patch('service-categories/:id')
  @RequirePermission('services:manage')
  @ApiOperation({ summary: 'Update a category (admin only)' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.services.updateCategory(id, dto);
  }
}
