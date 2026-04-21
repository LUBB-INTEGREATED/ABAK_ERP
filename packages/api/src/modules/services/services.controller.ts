import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a service (admin only)' })
  create(@Body() dto: CreateServiceDto) {
    return this.services.create(dto);
  }

  @Patch('services/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a service (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }

  @Delete('services/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a category (admin only)' })
  createCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.services.createCategory(dto);
  }

  @Patch('service-categories/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a category (admin only)' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.services.updateCategory(id, dto);
  }
}
