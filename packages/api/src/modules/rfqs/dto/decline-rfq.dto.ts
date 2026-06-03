import { ApiProperty } from '@nestjs/swagger';
import { RfqDeclineType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class DeclineRfqDto {
  @ApiProperty({ enum: RfqDeclineType })
  @IsEnum(RfqDeclineType)
  type!: RfqDeclineType;

  @ApiProperty({ description: 'Required reason for the decline.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
