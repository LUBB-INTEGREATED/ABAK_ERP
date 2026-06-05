import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Ahmed', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Al-Saleh', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '+966501234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  // A-1 (SECURITY): `role` was an attacker-controllable optional enum honored
  // verbatim by register() on a @Public route — one anonymous POST yielded a
  // SUPER_ADMIN session. The field is removed entirely: self-registration must
  // never let the caller pick a role. register() always assigns the lowest
  // privilege (SALES_REPRESENTATIVE). Privilege grants go through the
  // authenticated, permission-gated admin user-management surface.
}

export class LoginDto {
  @ApiProperty({ example: 'admin@abak.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
