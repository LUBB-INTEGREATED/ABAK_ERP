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
  AcceptRejectQuoteDto,
  AcceptWonDto,
  CreateQuoteDto,
  DecideApprovalDto,
  POStatusDto,
  QuoteFilterDto,
  SubmitQuoteDto,
  UpdateQuoteDto,
} from './dto';
import { QuotesService } from './quotes.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';

@ApiTags('quotes')
@ApiBearerAuth('JWT-auth')
@Controller()
@RequirePermission('quote:view')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  // Quotes ---------------------------------------------------------

  @Post('quotes')
  @RequirePermission('quote:build')
  @ApiOperation({ summary: 'Create a DRAFT quote with items and milestones' })
  create(@Body() dto: CreateQuoteDto, @CurrentUser('id') actorId: string) {
    return this.quotes.create(dto, actorId);
  }

  @Get('quotes')
  @ApiOperation({ summary: 'List quotes with filters and pagination' })
  findAll(
    @Query() filter: QuoteFilterDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('quote:view') scope: PermissionScope | undefined,
  ) {
    return this.quotes.findAll(filter, { user, scope });
  }

  @Get('quotes/stats')
  @ApiOperation({ summary: 'Quote totals and status breakdown' })
  stats() {
    return this.quotes.stats();
  }

  @Get('quotes/:id')
  @ApiOperation({
    summary: 'Get a quote with items, milestones, approvals, and PO',
  })
  findOne(@Param('id') id: string) {
    return this.quotes.findOne(id);
  }

  @Patch('quotes/:id')
  @RequirePermission('quote:build')
  @ApiOperation({ summary: 'Update a DRAFT quote' })
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(id, dto);
  }

  @Delete('quotes/:id')
  @RequirePermission('quote:build')
  @ApiOperation({ summary: 'Soft-delete a DRAFT quote' })
  remove(@Param('id') id: string) {
    return this.quotes.softDelete(id);
  }

  // Lifecycle ------------------------------------------------------

  @Patch('quotes/:id/submit')
  @RequirePermission('quote:submit_approval')
  @ApiOperation({
    summary:
      'Submit a DRAFT quote — auto-creates approvals based on configured thresholds',
  })
  submit(@Param('id') id: string, @Body() dto: SubmitQuoteDto) {
    return this.quotes.submit(id, dto);
  }

  @Patch('quotes/:id/send')
  @RequirePermission('quote:send')
  @ApiOperation({
    summary: 'Send an APPROVED quote (flips to SENT, stamps sentAt)',
  })
  send(@Param('id') id: string) {
    return this.quotes.send(id);
  }

  @Patch('quotes/:id/in-discussion')
  @RequirePermission('quote:set_outcome')
  @ApiOperation({
    summary: 'Mark a SENT quote as IN_DISCUSSION (client reviewing)',
  })
  setInDiscussion(@Param('id') id: string) {
    return this.quotes.setFollowUpStatus(id, 'IN_DISCUSSION');
  }

  @Patch('quotes/:id/in-negotiation')
  @RequirePermission('quote:set_outcome')
  @ApiOperation({
    summary: 'Mark a SENT/IN_DISCUSSION quote as IN_NEGOTIATION',
  })
  setInNegotiation(@Param('id') id: string) {
    return this.quotes.setFollowUpStatus(id, 'IN_NEGOTIATION');
  }

  @Patch('quotes/:id/accept')
  @RequirePermission('quote:set_outcome')
  @ApiOperation({
    summary:
      'Mark quote WON — records a CommercialConfirmation in PENDING state. PO is minted only after Finance validates (BR-12).',
  })
  accept(
    @Param('id') id: string,
    @Body() dto: AcceptWonDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.quotes.accept(id, dto, actorId);
  }

  // 1-click conversion: Won Quote → live Project (Department Manager flow).
  // 2026-05-21 process correction — see docs/CORRECTED_CLIENT_JOURNEY.md §G.
  @Post('quotes/:id/convert-to-project')
  @RequirePermission('project:convert')
  @ApiOperation({
    summary:
      'Convert a Won quote to a live Project in one click. Auto-validates the commercial confirmation, mints the PO, creates the Project + default phases.',
  })
  convertToProject(
    @Param('id') id: string,
    @Body()
    dto: { title?: string; description?: string; startDate?: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.quotes.convertToProject(id, dto, actorId);
  }

  @Patch('quotes/:id/reject')
  @RequirePermission('quote:set_outcome')
  @ApiOperation({ summary: 'Mark quote as REJECTED with optional reason' })
  reject(@Param('id') id: string, @Body() dto: AcceptRejectQuoteDto) {
    return this.quotes.reject(id, dto);
  }

  @Patch('quotes/:id/postpone')
  @RequirePermission('quote:set_outcome')
  @ApiOperation({
    summary:
      'Mark quote POSTPONED — BR-10: follow-up date required, max 30 days',
  })
  postpone(
    @Param('id') id: string,
    @Body() dto: { followUpDate: string; notes?: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.quotes.postpone(id, dto, actorId);
  }

  @Post('quotes/:id/revise')
  @RequirePermission('quote:build')
  @ApiOperation({
    summary:
      'Create a new revision. Parent quote is locked to REVISED (BR-08).',
  })
  revise(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.quotes.revise(id, actorId);
  }

  // Approvals ------------------------------------------------------

  @Patch('quotes/:id/approvals/:approvalId')
  @RequirePermission('quote:approve')
  @ApiOperation({ summary: 'Approve or reject a pending approval' })
  decideApproval(
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.quotes.decideApproval(id, approvalId, dto, actorId);
  }

  @Post('quotes/:id/approvals/:approvalId/request-revision')
  @RequirePermission('quote:approve')
  @ApiOperation({
    summary:
      'Approver requests revisions — quote flips to IN_REVISION with the comment recorded on the approval (M4-015).',
  })
  requestRevision(
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: { comments: string },
    @CurrentUser('id') actorId: string,
  ) {
    return this.quotes.requestRevision(id, approvalId, dto, actorId);
  }

  // Purchase Orders -----------------------------------------------

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders (most recent first)' })
  listPOs() {
    return this.quotes.listPurchaseOrders();
  }

  @Patch('purchase-orders/:id/status')
  @RequirePermission('finance:manage_invoice')
  @ApiOperation({
    summary: 'Update PO status (ACTIVE / COMPLETED / CANCELLED)',
  })
  updatePoStatus(@Param('id') id: string, @Body() dto: POStatusDto) {
    return this.quotes.updatePoStatus(id, dto);
  }
}
