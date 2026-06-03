import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { DeclineRfqDto } from './dto/decline-rfq.dto';
import { ListRfqsDto } from './dto/list-rfqs.dto';
import { RerouteRfqDto } from './dto/reroute-rfq.dto';
import { RfqsService } from './rfqs.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';

@ApiTags('rfqs')
@Controller('rfqs')
@RequirePermission('rfq:view')
export class RfqsController {
  constructor(private readonly service: RfqsService) {}

  @Post()
  @RequirePermission('rfq:request')
  @ApiOperation({ summary: 'Create RFQ from READY_FOR_RFQ opportunity' })
  create(@Body() dto: CreateRfqDto, @CurrentUser('id') actorId: string) {
    return this.service.create(dto, actorId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'RFQ stats' })
  stats() {
    return this.service.stats();
  }

  @Get()
  @ApiOperation({ summary: 'List RFQs (paged, filterable)' })
  list(
    @Query() query: ListRfqsDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:view') scope: PermissionScope | undefined,
  ) {
    return this.service.list(query, { user, scope });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RFQ detail' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:view') scope: PermissionScope | undefined,
  ) {
    return this.service.findOne(id, { user, scope });
  }

  // DM-7: lifecycle routes (assign-coordinator/-contributor, start-preparation,
  // submit-for-approval, dispatch, outcome) are removed. submit/approve/send/
  // outcome live on the Quote (/quotes/:id/*).

  @Post(':id/start-pricing')
  @RequirePermission('quote:build')
  @ApiOperation({
    summary:
      'Accept & assign: mint the Draft Quote from the RFQ, flip to PRICING',
  })
  startPricing(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('quote:build') scope: PermissionScope | undefined,
  ) {
    return this.service.startPricing(id, actorId, { user, scope });
  }

  @Post(':id/decline')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({
    summary:
      'Not us — decline an RFQ with a required reason (wrong_dept | no_bid)',
  })
  decline(
    @Param('id') id: string,
    @Body() dto: DeclineRfqDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:assign_pricers') scope: PermissionScope | undefined,
  ) {
    return this.service.declineRfq(id, dto, actorId, { user, scope });
  }

  @Post(':id/reroute')
  @RequirePermission('rfq:request')
  @ApiOperation({
    summary:
      'Re-route a wrong-department decline back to triage (new categories)',
  })
  reroute(
    @Param('id') id: string,
    @Body() dto: RerouteRfqDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request') scope: PermissionScope | undefined,
  ) {
    return this.service.reroute(id, dto, { user, scope });
  }

  @Post(':id/cancel')
  @RequirePermission('rfq:request')
  @ApiOperation({ summary: 'Cancel RFQ (non-terminal only)' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request') scope: PermissionScope | undefined,
  ) {
    return this.service.cancel(id, { user, scope });
  }
}
