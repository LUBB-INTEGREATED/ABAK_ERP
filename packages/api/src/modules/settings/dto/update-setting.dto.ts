import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateSettingDto {
  @ApiProperty({ description: 'Stringified value; service parses per type.' })
  @IsString()
  value!: string;
}
