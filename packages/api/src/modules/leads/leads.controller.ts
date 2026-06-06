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
import { Headers, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import {
  AssignLeadDto,
  CreateLeadDto,
  LeadFilterDto,
  LogLeadInteractionDto,
  RequestRfqDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
} from './dto';
import { LeadsService } from './leads.service';
import { SlaService } from './sla.service';

@ApiTags('leads')
@ApiBearerAuth('JWT-auth')
@Controller('leads')
@RequirePermission('leads:view')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly sla: SlaService,
    private readonly config: ConfigService,
  ) {}

  @Post('recompute-sla')
  @RequirePermission('leads:edit')
  @ApiOperation({
    summary:
      'Recompute SLA status for every open lead (cron runs automatically every 30 minutes)',
  })
  recomputeSla() {
    return this.sla.recomputeAll();
  }

  @Post()
  @RequirePermission('leads:create')
  @ApiOperation({ summary: 'Create a new lead' })
  create(@Body() dto: CreateLeadDto, @CurrentUser('id') actorId: string) {
    return this.leads.create(dto, actorId);
  }

  @Post(':id/request-rfq')
  @RequirePermission('rfq:request')
  @ApiOperation({
    summary:
      'Request an RFQ from a lead — auto-qualifies the lead and creates the client (if needed), the READY_FOR_RFQ opportunity, and the RFQ in one step (CORRECTED_CLIENT_JOURNEY Activity B).',
  })
  requestRfq(
    @Param('id') id: string,
    @Body() dto: RequestRfqDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request') scope: PermissionScope | undefined,
  ) {
    return this.leads.requestRfq(id, dto, actorId, { user, scope });
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filters and pagination' })
  findAll(
    @Query() filter: LeadFilterDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:view') scope: PermissionScope | undefined,
  ) {
    return this.leads.findAll(filter, { user, scope });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate counts by status, channel, and SLA' })
  stats(
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:view') scope: PermissionScope | undefined,
  ) {
    return this.leads.stats({ user, scope });
  }

  @Get('find-duplicates')
  @ApiOperation({
    summary:
      'Check for duplicate leads in the last 30 days by email or phone (M1-016).',
  })
  findDuplicates(
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    return this.leads.findDuplicates({ email, phone });
  }

  @Public()
  @Post('chatbot')
  @ApiOperation({
    summary:
      'AI chatbot lead intake (CH-AI). Public but guarded by shared secret header X-Chatbot-Token.',
  })
  async createFromChatbot(
    @Body()
    dto: {
      contactName: string;
      phone: string;
      email?: string;
      companyName?: string;
      serviceDetails?: string;
      projectLocation?: string;
      conversationId?: string;
    },
    @Headers('x-chatbot-token') token: string,
  ) {
    const expected =
      this.config.get<string>('app.chatbotToken') ??
      process.env.CHATBOT_TOKEN ??
      null;
    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid chatbot token');
    }
    return this.leads.createFromChatbot(dto);
  }

  @Get('number/:leadNumber')
  @ApiOperation({ summary: 'Fetch a lead by its LEAD-YYYY-XXXX number' })
  findByNumber(
    @Param('leadNumber') leadNumber: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:view') scope: PermissionScope | undefined,
  ) {
    return this.leads.findByNumber(leadNumber, { user, scope });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a lead by id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:view') scope: PermissionScope | undefined,
  ) {
    return this.leads.findOne(id, { user, scope });
  }

  @Patch(':id')
  @RequirePermission('leads:edit')
  @ApiOperation({ summary: 'Update lead fields' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:edit') scope: PermissionScope | undefined,
  ) {
    return this.leads.update(id, dto, { user, scope });
  }

  @Patch(':id/assign')
  @RequirePermission('leads:edit')
  @ApiOperation({ summary: 'Assign the lead to a user' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:edit') scope: PermissionScope | undefined,
  ) {
    return this.leads.assign(id, dto, { user, scope });
  }

  @Patch(':id/auto-assign')
  @RequirePermission('leads:edit')
  @ApiOperation({
    summary:
      'Pick an assignee using the configured auto-assign strategy and apply it',
  })
  autoAssign(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:edit') scope: PermissionScope | undefined,
  ) {
    return this.leads.autoAssign(id, { user, scope });
  }

  @Patch(':id/status')
  @RequirePermission('leads:edit')
  @ApiOperation({ summary: 'Transition lead status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:edit') scope: PermissionScope | undefined,
  ) {
    return this.leads.updateStatus(id, dto, { user, scope });
  }

  @Delete(':id')
  @RequirePermission('leads:edit')
  @ApiOperation({ summary: 'Soft delete (archive) the lead' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:edit') scope: PermissionScope | undefined,
  ) {
    return this.leads.softDelete(id, { user, scope });
  }

  // Communications log (2026-05-21 process correction).
  // See docs/CORRECTED_CLIENT_JOURNEY.md §A.

  @Get(':id/interactions')
  @ApiOperation({
    summary:
      'List communications-log entries for this lead (reverse chronological).',
  })
  listInteractions(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('leads:view') scope: PermissionScope | undefined,
  ) {
    return this.leads.listInteractions(id, { user, scope });
  }

  @Post(':id/interactions')
  @RequirePermission('comms:log')
  @ApiOperation({
    summary:
      'Log a communication entry (call / meeting / WhatsApp / etc.) on this lead.',
  })
  logInteraction(
    @Param('id') id: string,
    @Body() dto: LogLeadInteractionDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.leads.logInteraction(id, dto, actorId, { user, scope });
  }
}
