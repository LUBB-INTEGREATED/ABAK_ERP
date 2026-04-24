import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import type { ReportFilters } from './report-definition.interface';
import { CreateSavedReportDto } from './dto';
import { ReportsService } from './reports.service';

const REPORT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.SALES_MANAGER,
  UserRole.FINANCE_MANAGER,
  UserRole.SALES_REPRESENTATIVE,
];

@ApiTags('reports')
@Controller('reports')
@UseGuards(RolesGuard)
@Roles(...REPORT_ROLES)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get()
  @ApiOperation({
    summary: 'List available report codes for the current user role',
  })
  catalog(@CurrentUser('role') role: UserRole) {
    return this.service.catalog(role);
  }

  @Get('executive-kpis')
  @ApiOperation({ summary: 'Executive KPI dashboard (60s server-side cache)' })
  executiveKpis(@CurrentUser('role') role: UserRole) {
    return this.service.executiveKpis(role);
  }

  @Get('saved')
  @ApiOperation({ summary: 'List saved reports for the current user' })
  listSaved(@CurrentUser('id') ownerId: string) {
    return this.service.listSavedReports(ownerId);
  }

  @Post('saved')
  @ApiOperation({ summary: 'Save a report configuration' })
  createSaved(
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateSavedReportDto,
  ) {
    return this.service.createSavedReport(ownerId, dto);
  }

  @Delete('saved/:id')
  @ApiOperation({ summary: 'Delete a saved report' })
  deleteSaved(@Param('id') id: string, @CurrentUser('id') ownerId: string) {
    return this.service.deleteSavedReport(id, ownerId);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Run a report with filters' })
  run(
    @Param('code') code: string,
    @Query() query: Record<string, string>,
    @CurrentUser('role') role: UserRole,
  ) {
    const { export: _, ...filters } = query;
    return this.service.run(code, filters as ReportFilters, role);
  }

  @Get(':code/export')
  @ApiOperation({ summary: 'Export a report as CSV' })
  async export(
    @Param('code') code: string,
    @Query() query: Record<string, string>,
    @CurrentUser('role') role: UserRole,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(
      code,
      query as ReportFilters,
      role,
    );
    const filename = `${code}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  }
}
