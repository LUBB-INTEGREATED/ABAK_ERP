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
  CreateQuoteDto,
  DecideApprovalDto,
  POStatusDto,
  QuoteFilterDto,
  SubmitQuoteDto,
  UpdateQuoteDto,
} from './dto';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth('JWT-auth')
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  // Quotes ---------------------------------------------------------

  @Post('quotes')
  @ApiOperation({ summary: 'Create a DRAFT quote with items and milestones' })
  create(@Body() dto: CreateQuoteDto, @CurrentUser('id') actorId: string) {
    return this.quotes.create(dto, actorId);
  }

  @Get('quotes')
  @ApiOperation({ summary: 'List quotes with filters and pagination' })
  findAll(@Query() filter: QuoteFilterDto) {
    return this.quotes.findAll(filter);
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
  @ApiOperation({ summary: 'Update a DRAFT quote' })
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(id, dto);
  }

  @Delete('quotes/:id')
  @ApiOperation({ summary: 'Soft-delete a DRAFT quote' })
  remove(@Param('id') id: string) {
    return this.quotes.softDelete(id);
  }

  // Lifecycle ------------------------------------------------------

  @Patch('quotes/:id/submit')
  @ApiOperation({
    summary:
      'Submit a DRAFT quote — auto-creates approvals based on configured thresholds',
  })
  submit(@Param('id') id: string, @Body() dto: SubmitQuoteDto) {
    return this.quotes.submit(id, dto);
  }

  @Patch('quotes/:id/send')
  @ApiOperation({
    summary: 'Send an APPROVED quote (flips to SENT, stamps sentAt)',
  })
  send(@Param('id') id: string) {
    return this.quotes.send(id);
  }

  @Patch('quotes/:id/accept')
  @ApiOperation({
    summary:
      'Mark quote as ACCEPTED — creates a PO and bumps client lifetime value',
  })
  accept(@Param('id') id: string) {
    return this.quotes.accept(id);
  }

  @Patch('quotes/:id/reject')
  @ApiOperation({ summary: 'Mark quote as REJECTED with optional reason' })
  reject(@Param('id') id: string, @Body() dto: AcceptRejectQuoteDto) {
    return this.quotes.reject(id, dto);
  }

  // Approvals ------------------------------------------------------

  @Patch('quotes/:id/approvals/:approvalId')
  @ApiOperation({ summary: 'Approve or reject a pending approval' })
  decideApproval(
    @Param('id') id: string,
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.quotes.decideApproval(id, approvalId, dto, actorId);
  }

  // Purchase Orders -----------------------------------------------

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders (most recent first)' })
  listPOs() {
    return this.quotes.listPurchaseOrders();
  }

  @Patch('purchase-orders/:id/status')
  @ApiOperation({
    summary: 'Update PO status (ACTIVE / COMPLETED / CANCELLED)',
  })
  updatePoStatus(@Param('id') id: string, @Body() dto: POStatusDto) {
    return this.quotes.updatePoStatus(id, dto);
  }
}
