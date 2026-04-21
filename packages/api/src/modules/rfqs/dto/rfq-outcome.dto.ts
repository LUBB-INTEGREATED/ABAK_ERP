import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfirmationType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum RfqOutcomeValue {
  WON = 'WON',
  LOST = 'LOST',
  POSTPONED = 'POSTPONED',
}

export class RfqOutcomeDto {
  @ApiProperty({ enum: RfqOutcomeValue })
  @IsEnum(RfqOutcomeValue)
  outcome!: RfqOutcomeValue;

  // WON requires confirmation fields
  @ApiPropertyOptional({ enum: ConfirmationType })
  @ValidateIf((o) => o.outcome === RfqOutcomeValue.WON)
  @IsEnum(ConfirmationType, {
    message: 'confirmationType is required when outcome=WON',
  })
  confirmationType?: ConfirmationType;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.outcome === RfqOutcomeValue.WON)
  @IsISO8601({}, { message: 'confirmationAt is required when outcome=WON' })
  confirmationAt?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => o.outcome === RfqOutcomeValue.WON)
  @IsNumber()
  @IsPositive({
    message: 'confirmationValue must be positive when outcome=WON',
  })
  confirmationValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmationDocUrl?: string;

  // LOST requires reason
  @ApiPropertyOptional()
  @ValidateIf((o) => o.outcome === RfqOutcomeValue.LOST)
  @IsString({ message: 'lostReason is required when outcome=LOST' })
  @MinLength(5)
  lostReason?: string;

  // POSTPONED requires a future date to follow up
  @ApiPropertyOptional()
  @ValidateIf((o) => o.outcome === RfqOutcomeValue.POSTPONED)
  @IsISO8601({
    message: 'postponedUntil is required when outcome=POSTPONED',
  })
  postponedUntil?: string;
}
