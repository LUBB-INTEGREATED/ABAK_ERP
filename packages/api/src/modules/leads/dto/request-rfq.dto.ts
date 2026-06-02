import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RfqPriority, RfqSource } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * One-click "Request RFQ" from a lead (CORRECTED_CLIENT_JOURNEY Activity B).
 * The action auto-qualifies the lead, ensures a client + a READY_FOR_RFQ
 * pipeline opportunity, and creates the RFQ — in one step.
 */
export class RequestRfqDto {
  @ApiProperty({ description: 'Short service-type label for the RFQ.' })
  @IsString()
  @MinLength(3)
  serviceType!: string;

  @ApiProperty({ description: 'Project scope / brief (min 10 chars).' })
  @IsString()
  @MinLength(10)
  projectScope!: string;

  @ApiProperty({
    description:
      'Service-category ids (the departments that will price a section). At least one.',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  departmentIds!: string[];

  @ApiPropertyOptional({ enum: RfqPriority, default: RfqPriority.NORMAL })
  @IsOptional()
  @IsEnum(RfqPriority)
  priority?: RfqPriority;

  @ApiPropertyOptional({
    enum: RfqSource,
    default: RfqSource.INTERNAL_REP,
    description: 'Defaults to INTERNAL_REP (the sales rep raising it).',
  })
  @IsOptional()
  @IsEnum(RfqSource)
  requestedByChannel?: RfqSource;

  @ApiPropertyOptional({ description: 'Optional estimated opportunity value.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;
}
