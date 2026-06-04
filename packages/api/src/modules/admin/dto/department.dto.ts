import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

const DEPT_TYPES = [
  'TECHNICAL',
  'SALES',
  'FINANCE',
  'HR',
  'EXECUTIVE',
  'SUPPORT',
] as const;

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Structural Engineering' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiProperty({ enum: DEPT_TYPES, default: 'TECHNICAL' })
  @IsIn(DEPT_TYPES as unknown as string[])
  type!: (typeof DEPT_TYPES)[number];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ enum: DEPT_TYPES })
  @IsOptional()
  @IsIn(DEPT_TYPES as unknown as string[])
  type?: (typeof DEPT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;

  /** Pass null to clear the manager. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  managerId?: string | null;
}
