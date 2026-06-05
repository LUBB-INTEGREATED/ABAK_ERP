import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommissionStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentValidationStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// ─── Invoices ──────────────────────────────────────────────────

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  poId!: string;

  @ApiProperty()
  @IsISO8601()
  dueDate!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  subtotal!: number;

  @ApiProperty({ description: 'Tax amount (VAT etc.)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneId?: string;
}

export class ListInvoicesDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

// ─── Payments ──────────────────────────────────────────────────

export class RecordPaymentDto {
  @ApiProperty()
  @IsString()
  poId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty()
  @IsISO8601()
  receivedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docUrl?: string;
}

export class ValidatePaymentDto {
  @ApiProperty({
    enum: [PaymentValidationStatus.VALIDATED, PaymentValidationStatus.REJECTED],
  })
  @IsEnum(PaymentValidationStatus)
  status!: PaymentValidationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  note?: string;
}

export class ListPaymentsDto {
  @ApiPropertyOptional({ enum: PaymentValidationStatus })
  @IsOptional()
  @IsEnum(PaymentValidationStatus)
  validationStatus?: PaymentValidationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  poId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

// ─── Commercial confirmations ─────────────────────────────────

export class ValidateCommercialConfirmationDto {
  @ApiProperty({
    enum: [PaymentValidationStatus.VALIDATED, PaymentValidationStatus.REJECTED],
  })
  @IsEnum(PaymentValidationStatus)
  status!: PaymentValidationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  note?: string;
}

export class ListCommercialConfirmationsDto {
  @ApiPropertyOptional({ enum: PaymentValidationStatus })
  @IsOptional()
  @IsEnum(PaymentValidationStatus)
  status?: PaymentValidationStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

// ─── Commissions (M7-005 — Finance-only) ──────────────────────

export class ListCommissionsDto {
  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
