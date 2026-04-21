import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Structural Engineering' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceCategoryDto extends PartialType(
  CreateServiceCategoryDto,
) {}

export class CreateServiceDto {
  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty({ example: 'Structural Design & Calculations' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'STRUCT-001' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ example: 'per project' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
