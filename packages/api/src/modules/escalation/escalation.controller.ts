import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { EscalationService } from './escalation.service';

@ApiTags('escalation')
@Controller('admin/escalation')
@RequirePermission('settings:view')
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
