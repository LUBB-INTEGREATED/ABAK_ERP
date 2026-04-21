import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum ContributorRole {
  TECHNICAL = 'TECHNICAL',
  FINANCIAL = 'FINANCIAL',
}

export class AssignContributorDto {
  @ApiProperty({ enum: ContributorRole })
  @IsEnum(ContributorRole)
  role!: ContributorRole;

  @ApiProperty()
  @IsString()
  userId!: string;
}
