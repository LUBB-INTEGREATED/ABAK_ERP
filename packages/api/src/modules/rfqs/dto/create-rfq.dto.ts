import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RfqPriority, RfqSource } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateRfqDto {
  @ApiProperty({
    description: 'Pipeline opportunity id (READY_FOR_RFQ stage).',
  })
  @IsString()
  opportunityId!: string;

  @ApiProperty({ description: 'Short service type label.' })
  @IsString()
  @MinLength(3)
  serviceType!: string;

  @ApiProperty({ description: 'Project scope / brief.' })
  @IsString()
  @MinLength(10)
  projectScope!: string;

  @ApiPropertyOptional({ enum: RfqPriority, default: RfqPriority.NORMAL })
  @IsOptional()
  @IsEnum(RfqPriority)
  priority?: RfqPriority;

  @ApiProperty({ enum: RfqSource })
  @IsEnum(RfqSource)
  requestedByChannel!: RfqSource;

  @ApiPropertyOptional({
    description: 'Required when requestedByChannel=BROKER.',
  })
  @ValidateIf((dto) => dto.requestedByChannel === RfqSource.BROKER)
  @IsString({ message: 'brokerName is required when source is BROKER' })
  @MinLength(2)
  brokerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brokerPhone?: string;
}
