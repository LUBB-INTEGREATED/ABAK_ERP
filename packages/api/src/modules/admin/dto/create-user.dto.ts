import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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

export class CreateUserDto {
  @ApiProperty({ example: 'eng@abak.com.sa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  firstName!: string;

  @ApiProperty()
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Department membership' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Role IDs to assign' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ enum: STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({
    enum: LEGACY_ROLES,
    description:
      'Legacy system role (drives JWT + sidebar gating during RBAC migration). Defaults to VIEWER; real access comes from assigned roles.',
  })
  @IsOptional()
  @IsIn(LEGACY_ROLES as unknown as string[])
  legacyRole?: (typeof LEGACY_ROLES)[number];
}
