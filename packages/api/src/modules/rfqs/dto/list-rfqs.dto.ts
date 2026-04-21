import { ApiPropertyOptional } from '@nestjs/swagger';
import { RfqPriority, RfqSource, RfqStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListRfqsDto {
  @ApiPropertyOptional({ enum: RfqStatus })
  @IsOptional()
  @IsEnum(RfqStatus)
  status?: RfqStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ enum: RfqSource })
  @IsOptional()
  @IsEnum(RfqSource)
  source?: RfqSource;

  @ApiPropertyOptional({ enum: RfqPriority })
  @IsOptional()
  @IsEnum(RfqPriority)
  priority?: RfqPriority;

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
