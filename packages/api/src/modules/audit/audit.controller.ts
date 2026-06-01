import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { AuditService } from './audit.service';

@ApiTags('admin-audit')
@Controller('admin/audit')
@RequirePermission('audit:view')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit events (paged)' })
  list(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      userId,
      entity,
      entityId,
      action,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('resource/:entity/:entityId')
  @ApiOperation({ summary: 'List audit events for a single entity' })
  forEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.service.listForEntity(entity, entityId);
  }
}
