import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EscalationService } from './escalation.service';

@ApiTags('escalation')
@Controller('admin/escalation')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class EscalationController {
  constructor(private readonly service: EscalationService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List escalation rules' })
  listRules() {
    return this.service.listRules();
  }

  @Get('instances')
  @ApiOperation({ summary: 'List open escalation instances' })
  list(@Query('includeResolved') includeResolved?: string) {
    return this.service.list(includeResolved === 'true');
  }
}
