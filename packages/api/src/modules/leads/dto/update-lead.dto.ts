import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  qualificationScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualificationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lostReason?: string;
}
