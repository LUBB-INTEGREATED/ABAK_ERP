import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { GovAuthorityCategory, GovTxStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
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

export class CreateGovTransactionDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  authorityName!: string;

  @ApiProperty({ enum: GovAuthorityCategory })
  @IsEnum(GovAuthorityCategory)
  authorityCategory!: GovAuthorityCategory;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  transactionType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedProId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedEngineerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedResponseAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fees?: number;
}

export class UpdateGovTransactionDto extends PartialType(
  CreateGovTransactionDto,
) {}

export class TransitionGovTxStatusDto {
  @ApiProperty({ enum: GovTxStatus })
  @IsEnum(GovTxStatus)
  status!: GovTxStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ListGovTransactionsDto {
  @ApiPropertyOptional({ enum: GovTxStatus })
  @IsOptional()
  @IsEnum(GovTxStatus)
  status?: GovTxStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ enum: GovAuthorityCategory })
  @IsOptional()
  @IsEnum(GovAuthorityCategory)
  authorityCategory?: GovAuthorityCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedProId?: string;

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

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class LogVisitDto {
  @ApiProperty()
  @IsISO8601()
  visitedAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  purpose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class LogCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  commentText!: string;

  @ApiProperty()
  @IsISO8601()
  issuedAt!: string;
}

export class RespondCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  responseText!: string;
}

export class UploadDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class WeeklyStatusUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
