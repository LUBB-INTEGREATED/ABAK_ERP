import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AssignContributorDto } from './dto/assign-contributor.dto';
import { AssignCoordinatorDto } from './dto/assign-coordinator.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { DispatchRfqDto } from './dto/dispatch-rfq.dto';
import { ListRfqsDto } from './dto/list-rfqs.dto';
import { RfqOutcomeDto } from './dto/rfq-outcome.dto';
import { RfqsService } from './rfqs.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

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
  list(@Query() query: ListRfqsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RFQ detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/assign-coordinator')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({ summary: 'Assign primary RFQ coordinator' })
  assignCoordinator(
    @Param('id') id: string,
    @Body() dto: AssignCoordinatorDto,
  ) {
    return this.service.assignCoordinator(id, dto);
  }

  @Patch(':id/assign-contributor')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({ summary: 'Assign technical or financial contributor' })
  assignContributor(
    @Param('id') id: string,
    @Body() dto: AssignContributorDto,
  ) {
    return this.service.assignContributor(id, dto);
  }

  @Patch(':id/start-preparation')
  @RequirePermission('rfq:price_section')
  @ApiOperation({ summary: 'Transition ASSIGNED → IN_PREPARATION' })
  startPreparation(@Param('id') id: string) {
    return this.service.startPreparation(id);
  }

  @Post(':id/submit-for-approval')
  @RequirePermission('quote:submit_approval')
  @ApiOperation({ summary: 'Submit linked Quote for approvals' })
  submitForApproval(@Param('id') id: string) {
    return this.service.submitForApproval(id);
  }

  @Post(':id/dispatch')
  @RequirePermission('quote:send')
  @ApiOperation({ summary: 'Dispatch quote to client (WhatsApp/Email)' })
  dispatch(@Param('id') id: string, @Body() dto: DispatchRfqDto) {
    return this.service.dispatch(id, dto);
  }

  @Post(':id/outcome')
  @RequirePermission('quote:set_outcome')
  @ApiOperation({ summary: 'Record RFQ outcome (WON/LOST/POSTPONED)' })
  recordOutcome(@Param('id') id: string, @Body() dto: RfqOutcomeDto) {
    return this.service.recordOutcome(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('rfq:request')
  @ApiOperation({ summary: 'Cancel RFQ (non-terminal only)' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
