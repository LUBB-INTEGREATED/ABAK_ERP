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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AssignLeadDto,
  CreateLeadDto,
  LeadFilterDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
} from './dto';
import { LeadsService } from './leads.service';
import { SlaService } from './sla.service';

@ApiTags('leads')
@ApiBearerAuth('JWT-auth')
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly sla: SlaService,
  ) {}

  @Post('recompute-sla')
  @ApiOperation({
    summary:
      'Recompute SLA status for every open lead (cron runs automatically every 30 minutes)',
  })
  recomputeSla() {
    return this.sla.recomputeAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  create(@Body() dto: CreateLeadDto, @CurrentUser('id') actorId: string) {
    return this.leads.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filters and pagination' })
  findAll(@Query() filter: LeadFilterDto) {
    return this.leads.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate counts by status, channel, and SLA' })
  stats() {
    return this.leads.stats();
  }

  @Get('number/:leadNumber')
  @ApiOperation({ summary: 'Fetch a lead by its LEAD-YYYY-XXXX number' })
  findByNumber(@Param('leadNumber') leadNumber: string) {
    return this.leads.findByNumber(leadNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a lead by id' })
  findOne(@Param('id') id: string) {
    return this.leads.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead fields' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign the lead to a user' })
  assign(@Param('id') id: string, @Body() dto: AssignLeadDto) {
    return this.leads.assign(id, dto);
  }

  @Patch(':id/auto-assign')
  @ApiOperation({
    summary:
      'Pick an assignee using the configured auto-assign strategy and apply it',
  })
  autoAssign(@Param('id') id: string) {
    return this.leads.autoAssign(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition lead status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leads.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete (archive) the lead' })
  remove(@Param('id') id: string) {
    return this.leads.softDelete(id);
  }
}
