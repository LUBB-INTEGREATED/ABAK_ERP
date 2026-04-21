import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PhaseCode,
  PhaseStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
  ValidateIf,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ description: 'Linked purchase-order id.' })
  @IsString()
  poId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Project manager user id.' })
  @IsString()
  pmId!: string;

  @ApiPropertyOptional({ description: 'Use default template if omitted.' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @ApiPropertyOptional({
    description: 'Skip auto-seeding the 7-phase template. Default false.',
  })
  @IsOptional()
  @IsBoolean()
  skipDefaultPhases?: boolean;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class TransitionProjectStatusDto {
  @ApiProperty({ enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListProjectsDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pmId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CreatePhaseDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: PhaseCode })
  @IsEnum(PhaseCode)
  phaseCode!: PhaseCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customLabel?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty()
  @IsString()
  ownerId!: string;

  @ApiProperty()
  @IsDateString()
  plannedStart!: string;

  @ApiProperty()
  @IsDateString()
  plannedEnd!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;
}

export class UpdatePhaseDto extends PartialType(CreatePhaseDto) {
  @ApiPropertyOptional({ enum: PhaseStatus })
  @IsOptional()
  @IsEnum(PhaseStatus)
  status?: PhaseStatus;
}

export class ReassignPhaseOwnerDto {
  @ApiProperty()
  @IsString()
  ownerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  reason!: string;
}

export class CompletePhaseDto {
  @ApiPropertyOptional({
    description:
      'Written sign-off (min 50 chars). One of evidenceNote or clientAcknowledgedAt required.',
  })
  @ValidateIf((o) => !o.clientAcknowledgedAt)
  @IsString({
    message: 'Either evidenceNote or clientAcknowledgedAt is required (BR-14).',
  })
  @MinLength(50, { message: 'evidenceNote must be at least 50 characters.' })
  evidenceNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  clientAcknowledgedAt?: string;
}

export class AdjustPhaseProgressDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPct!: number;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  reason!: string;
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.NORMAL })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class TransitionTaskStatusDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}

export class CreateDependencyDto {
  @ApiProperty()
  @IsString()
  blockerTaskId!: string;
}

export class ClosureGateDto {
  @ApiProperty({
    enum: [
      'ALL_PHASES_COMPLETED',
      'DELIVERABLES_SUBMITTED',
      'CLIENT_APPROVAL_RECEIVED',
      'FINAL_PAYMENT_RECEIVED',
      'FINANCE_CLEARANCE_ISSUED',
    ],
  })
  @IsString()
  gate!:
    | 'ALL_PHASES_COMPLETED'
    | 'DELIVERABLES_SUBMITTED'
    | 'CLIENT_APPROVAL_RECEIVED'
    | 'FINAL_PAYMENT_RECEIVED'
    | 'FINANCE_CLEARANCE_ISSUED';

  @ApiProperty()
  @IsBoolean()
  value!: boolean;
}
