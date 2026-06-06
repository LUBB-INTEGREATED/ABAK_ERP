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

/**
 * CHAIN-1: link a billable ServiceCategory to a department. A category may be
 * linked to several departments; the RFQ intake folds ServiceCategory →
 * Department via these links to find the inbox + pricer pool. Without a link a
 * new RFQ section can never be accepted/assigned (the live P0 blocker).
 */
export class LinkDepartmentServiceDto {
  @ApiProperty({
    description: 'The ServiceCategory id to link to this department.',
  })
  @IsString()
  @MinLength(1)
  serviceCategoryId!: string;
}
