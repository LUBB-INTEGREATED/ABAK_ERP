import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ApprovalStatus,
  ConfirmationType,
  DiscountType,
  LossReason,
  POStatus,
  QuoteStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Per-line methodology card (description + steps + deliverable). Renders on
 * page 5 of the canonical 8-page PDF.
 * Added 2026-05-21 process correction — see docs/CORRECTED_CLIENT_JOURNEY.md §4.
 */
export class MethodologyCardInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  steps?: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  deliverable!: string;
}

/**
 * Per-line gantt block. Renders on page 6 of the canonical PDF.
 * 2026-05-21 process correction.
 */
export class GanttBlockInputDto {
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startDay!: number;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiPropertyOptional({ default: '#2d7ad1' })
  @IsOptional()
  @IsString()
  categoryTone?: string;
}

export class QuoteItemInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  /**
   * Department (= ServiceCategory) that priced this item. Used to group
   * line items into per-department sections on the quote builder + PDF.
   * Added 2026-05-21 process correction.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position?: number;

  /** Optional per-line methodology card (description + steps + deliverable). */
  @ApiPropertyOptional({ type: MethodologyCardInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MethodologyCardInputDto)
  methodology?: MethodologyCardInputDto;

  /** Optional per-line gantt block (startDay + durationDays + tone). */
  @ApiPropertyOptional({ type: GanttBlockInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GanttBlockInputDto)
  gantt?: GanttBlockInputDto;
}

export class MilestoneInputDto {
  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  daysFromStart?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateQuoteDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryTimeline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientNotes?: string;

  @ApiPropertyOptional({ enum: DiscountType, default: DiscountType.FIXED })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({ type: [QuoteItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items?: QuoteItemInputDto[];

  @ApiPropertyOptional({ type: [MilestoneInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneInputDto)
  milestones?: MilestoneInputDto[];

  // Technical Scope fields (BPD M4)
  @ApiPropertyOptional({ description: 'Technical scope of work' })
  @IsOptional()
  @IsString()
  scopeOfWork?: string;

  @ApiPropertyOptional({ description: 'Project deliverables' })
  @IsOptional()
  @IsString()
  deliverables?: string;

  @ApiPropertyOptional({ description: 'Items excluded from scope' })
  @IsOptional()
  @IsString()
  exclusions?: string;

  @ApiPropertyOptional({ description: 'Assumptions underlying the quote' })
  @IsOptional()
  @IsString()
  assumptions?: string;

  @ApiPropertyOptional({ description: 'Number of revision rounds included' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfRevisions?: number;
}

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}

export class QuoteFilterDto {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preparedById?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class SubmitQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approverId?: string;
}

export class DecideApprovalDto {
  @ApiProperty({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}

export class AcceptRejectQuoteDto {
  @ApiPropertyOptional({ enum: LossReason })
  @IsOptional()
  @IsEnum(LossReason)
  reasonCode?: LossReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AcceptWonDto {
  @ApiPropertyOptional({
    enum: ConfirmationType,
    description:
      'Which kind of commercial confirmation the client provided. Defaults to PO.',
  })
  @IsOptional()
  @IsEnum(ConfirmationType)
  confirmationType?: ConfirmationType;

  @ApiPropertyOptional({
    description: 'Link to the client-supplied confirmation document.',
  })
  @IsOptional()
  @IsString()
  docUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class POStatusDto {
  @ApiProperty({ enum: POStatus })
  @IsEnum(POStatus)
  status!: POStatus;
}
