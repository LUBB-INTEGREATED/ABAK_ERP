import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentValidationStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  ListPaymentsDto,
  RecordPaymentDto,
  ValidateCommercialConfirmationDto,
  ValidatePaymentDto,
} from './dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller('finance')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE_MANAGER)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Finance KPIs' })
  stats() {
    return this.service.stats();
  }

  // ─── Commercial confirmations ─────────────────────────────────

  @Get('commercial-confirmations')
  @ApiOperation({ summary: 'List commercial confirmations (Finance inbox)' })
  listCommercialConfirmations(
    @Query('status') status?: PaymentValidationStatus,
  ) {
    return this.service.listCommercialConfirmations(status);
  }

  @Patch('commercial-confirmations/:id/validate')
  @ApiOperation({
    summary:
      'Finance validates the commercial confirmation. On VALIDATED, the PO is minted (BR-12).',
  })
  validateCommercialConfirmation(
    @Param('id') id: string,
    @Body() dto: ValidateCommercialConfirmationDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.validateCommercialConfirmation(id, dto, actorId);
  }

  // ─── Invoices ─────────────────────────────────────────────────

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices' })
  listInvoices(@Query() query: ListInvoicesDto) {
    return this.service.list(query);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create an invoice from a PO' })
  createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.createInvoice(dto, actorId);
  }

  // ─── Payments ─────────────────────────────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'List payments' })
  listPayments(@Query() query: ListPaymentsDto) {
    return this.service.listPayments(query);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Log a received payment (requires validation)' })
  recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.recordPayment(dto, actorId);
  }

  @Patch('payments/:id/validate')
  @ApiOperation({
    summary:
      'Validate or reject a payment (BR-17). Auto-updates invoice/PO + closure gate.',
  })
  validatePayment(
    @Param('id') id: string,
    @Body() dto: ValidatePaymentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.validatePayment(id, dto, actorId);
  }
}
