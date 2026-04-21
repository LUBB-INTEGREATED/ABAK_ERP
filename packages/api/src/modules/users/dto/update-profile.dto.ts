import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const LANGUAGES = ['ar', 'en'] as const;
const CALENDARS = ['GREGORIAN', 'HIJRI', 'BOTH'] as const;
const NUMERALS = ['LATIN', 'ARABIC_INDIC'] as const;

export class UpdateProfileDto {
  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES as unknown as string[])
  preferredLanguage?: (typeof LANGUAGES)[number];

  @ApiPropertyOptional({ enum: CALENDARS })
  @IsOptional()
  @IsIn(CALENDARS as unknown as string[])
  calendarDisplay?: (typeof CALENDARS)[number];

  @ApiPropertyOptional({ enum: NUMERALS })
  @IsOptional()
  @IsIn(NUMERALS as unknown as string[])
  numeralSystem?: (typeof NUMERALS)[number];

  @ApiPropertyOptional({ example: 'Asia/Riyadh' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  notificationQuietHoursStart?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  notificationQuietHoursEnd?: number;

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
}
