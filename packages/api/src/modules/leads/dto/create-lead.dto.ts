import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadChannel, LeadPriority } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateLeadDto {
  @ApiProperty({ enum: LeadChannel })
  @IsEnum(LeadChannel)
  channel!: LeadChannel;

  @ApiPropertyOptional({ example: 'Etimad Platform' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'REF-2026-0001' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ example: 'Mohammed Al-Ghamdi' })
  @IsString()
  @MinLength(2)
  contactName!: string;

  @ApiPropertyOptional({ example: 'Al-Ghamdi Real Estate' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'contact@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+966501234567' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ example: '+966501234568' })
  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceDetails?: string;

  @ApiPropertyOptional({ example: 'Riyadh' })
  @IsOptional()
  @IsString()
  projectLocation?: string;

  @ApiPropertyOptional({ example: '5000 sqm' })
  @IsOptional()
  @IsString()
  projectSize?: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budget?: number;

  @ApiPropertyOptional({ example: '6 months' })
  @IsOptional()
  @IsString()
  timeline?: string;

  @ApiPropertyOptional({ enum: LeadPriority })
  @IsOptional()
  @IsEnum(LeadPriority)
  priority?: LeadPriority;

  // Government tender specifics
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etimadNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fursaNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  tenderDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  tenderDetails?: Record<string, unknown>;

  // Referral specifics
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referredBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerCompany?: string;

  // Social media specifics
  @ApiPropertyOptional({ example: 'LinkedIn' })
  @IsOptional()
  @IsString()
  socialPlatform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  socialProfile?: string;

  // Google Maps specifics
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  mapsLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mapsReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  initialNotes?: string;

  @ApiPropertyOptional({
    example: 'user_cuid',
    description: 'Assign to user on create',
  })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualificationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lostReason?: string;

  // BPD channel-specific fields
  @ApiPropertyOptional({ example: 'Riyadh' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Al-Malaz' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'PERSONAL_CONTACT' })
  @IsOptional()
  @IsString()
  referralSourceType?: string;

  @ApiPropertyOptional({ example: '50K-200K' })
  @IsOptional()
  @IsString()
  expectedBudgetRange?: string;

  @ApiPropertyOptional({ example: 'URGENT' })
  @IsOptional()
  @IsString()
  clientUrgency?: string;

  @ApiPropertyOptional({ example: '@username' })
  @IsOptional()
  @IsString()
  socialUsername?: string;

  @ApiPropertyOptional({ example: 'CAM-2026-0001' })
  @IsOptional()
  @IsString()
  relatedCampaign?: string;

  @ApiPropertyOptional({ example: 'CONTACT_FORM' })
  @IsOptional()
  @IsString()
  webSource?: string;

  @ApiPropertyOptional({ example: 'GOOGLE_MAPS_MESSAGE' })
  @IsOptional()
  @IsString()
  mapContactMethod?: string;

  @ApiPropertyOptional({ example: 'GOOGLE_SEARCH' })
  @IsOptional()
  @IsString()
  mapHowFoundUs?: string;
}
