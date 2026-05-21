import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InteractionDirection, InteractionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Log a communication entry against a Lead (the comms-log primitive added by
 * the 2026-05-21 process correction — see docs/CORRECTED_CLIENT_JOURNEY.md
 * §A "Capture & grow a lead"). The Sales Person is the canonical single
 * thread-of-record; when an engineer logs site-visit coordination directly,
 * they CC the sales person via `ccAuthorIds` so it surfaces on the sales
 * person's queue without making them a bottleneck.
 */
export class LogLeadInteractionDto {
  @ApiProperty({ enum: InteractionType, example: 'CALL' })
  @IsEnum(InteractionType)
  type!: InteractionType;

  @ApiPropertyOptional({ enum: InteractionDirection })
  @IsOptional()
  @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiProperty({ example: 'Initial call — interested in supervision service' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional({ description: 'Defaults to now() if omitted.' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextAction?: string;

  /**
   * User IDs to CC on this log entry. Used when a non-sales actor (e.g. a
   * Department Engineer logging site-visit coordination) needs the
   * responsible Sales Person to see the entry on their queue.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ccAuthorIds?: string[];

  /**
   * Optional inline follow-up date. When set, the log entry doubles as a
   * follow-up reminder — Norman one-screen-two-outcomes pattern.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
