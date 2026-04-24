import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PipelineStage,
  TargetPeriod,
  TargetType,
  VisitType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePipelineEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ enum: PipelineStage, default: PipelineStage.NEW_LEAD })
  @IsOptional()
  @IsEnum(PipelineStage)
  stage?: PipelineStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseAt?: string;

  @ApiPropertyOptional({
    description: 'Next action the owner will take on this opportunity.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextStep?: string;

  @ApiPropertyOptional({ description: 'Due date for the next step' })
  @IsOptional()
  @IsDateString()
  nextStepDueDate?: string;

  @ApiPropertyOptional({ description: 'Name of the key decision maker' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  decisionMakerName?: string;

  @ApiPropertyOptional({ description: 'Phone/email of the decision maker' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  decisionMakerContact?: string;

  @ApiPropertyOptional({ description: 'Expected date for client decision' })
  @IsOptional()
  @IsDateString()
  expectedDecisionDate?: string;
}

export class UpdatePipelineEntryDto extends PartialType(
  CreatePipelineEntryDto,
) {}

export class MoveStageDto {
  @ApiProperty({ enum: PipelineStage })
  @IsEnum(PipelineStage)
  stage!: PipelineStage;

  @ApiPropertyOptional({
    description: 'Required when moving to LOST (lost reason) or POSTPONED',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Required when stage is POSTPONED',
  })
  @IsOptional()
  @IsDateString()
  postponedUntil?: string;

  @ApiPropertyOptional({ description: 'Next action after the stage move' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextStep?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextStepDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  decisionMakerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  decisionMakerContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDecisionDate?: string;
}

export class PipelineFilterDto {
  @ApiPropertyOptional({ enum: PipelineStage })
  @IsOptional()
  @IsEnum(PipelineStage)
  stage?: PipelineStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

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

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}

export class CreateFieldVisitDto {
  @ApiProperty({ enum: VisitType })
  @IsEnum(VisitType)
  visitType!: VisitType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  purpose!: string;

  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attendees?: string;
}

export class UpdateFieldVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;
}

export class CreateTargetDto {
  @ApiProperty()
  @IsString()
  ownerId!: string;

  @ApiProperty({ enum: TargetType })
  @IsEnum(TargetType)
  type!: TargetType;

  @ApiProperty({ enum: TargetPeriod })
  @IsEnum(TargetPeriod)
  period!: TargetPeriod;

  @ApiProperty()
  @IsDateString()
  periodStart!: string;

  @ApiProperty()
  @IsDateString()
  periodEnd!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  targetValue!: number;
}
