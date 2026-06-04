import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
const LEGACY_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'SALES_MANAGER',
  'SALES_REPRESENTATIVE',
  'TECHNICAL_MANAGER',
  'FINANCE_MANAGER',
  'PRO',
  'VIEWER',
] as const;

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  /** Pass null to detach from any department. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: LEGACY_ROLES })
  @IsOptional()
  @IsIn(LEGACY_ROLES as unknown as string[])
  legacyRole?: (typeof LEGACY_ROLES)[number];
}
