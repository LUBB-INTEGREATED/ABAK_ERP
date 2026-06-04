import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SCOPES = ['OWN', 'DEPARTMENT', 'ALL'] as const;

export class CreateRoleDto {
  @ApiProperty({ example: 'Branch Manager' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class PermissionAssignmentDto {
  @ApiProperty({ example: 'leads:view' })
  @IsString()
  key!: string;

  @ApiProperty({ enum: SCOPES, default: 'ALL' })
  @IsIn(SCOPES as unknown as string[])
  scope!: (typeof SCOPES)[number];
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [PermissionAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionAssignmentDto)
  permissions!: PermissionAssignmentDto[];
}
