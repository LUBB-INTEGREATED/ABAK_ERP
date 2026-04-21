import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  LeadChannel,
  LeadPriority,
  LeadStatus,
  SLAStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class LeadFilterDto {
  @ApiPropertyOptional({ enum: LeadChannel })
  @IsOptional()
  @IsEnum(LeadChannel)
  channel?: LeadChannel;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: LeadPriority })
  @IsOptional()
  @IsEnum(LeadPriority)
  priority?: LeadPriority;

  @ApiPropertyOptional({ enum: SLAStatus })
  @IsOptional()
  @IsEnum(SLAStatus)
  slaStatus?: SLAStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive contains match against projectLocation',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Minimum budget in SAR (inclusive)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum budget in SAR (inclusive)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({
    description: 'Search contactName, companyName, phone, email, leadNumber',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter leads created on or after this ISO date',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter leads created on or before this ISO date',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'leadNumber', 'slaResponseDue'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}
