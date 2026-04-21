import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @ApiPropertyOptional({
    description: 'Required for LOST or UNQUALIFIED transitions',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
