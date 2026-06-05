import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Partial update of the singleton CompanyProfile. Every field is optional — the
 * service applies only the keys that are present (omitted keys are untouched).
 *
 * Bank-sensitive fields (bankName, bankAccountName, iban, swift) are gated by
 * `company_profile.manage` at the controller and audited per-field on change in
 * the service (CompanyProfileHistory). IBAN format + bank-name sentinel are
 * validated in the service (cross-field / business rules), not here, so the
 * send-gate cannot be defeated by persisting a placeholder.
 *
 * `services` / `accreditations` are bilingual JSON arrays (string[] or
 * {name,nameAr}[]) — accepted as opaque arrays and stored as JSON.
 */
export class UpdateCompanyProfileDto {
  @ApiPropertyOptional({
    description: 'Whether this profile is the active one.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // About / who-we-are -------------------------------------------------------
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalNameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aboutTextAr?: string;

  @ApiPropertyOptional({
    description: 'Bilingual array: string[] or {name,nameAr}[].',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  services?: unknown[];

  @ApiPropertyOptional({
    description: 'Bilingual array: string[] or {name,nameAr}[].',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  accreditations?: unknown[];

  // Contact ------------------------------------------------------------------
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  // Bank (sensitive — company_profile.manage + per-field history audit) -------
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional({
    description:
      'Saudi IBAN: starts "SA", 24 chars total, not the SA0000… placeholder.',
  })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  swift?: string;
}
