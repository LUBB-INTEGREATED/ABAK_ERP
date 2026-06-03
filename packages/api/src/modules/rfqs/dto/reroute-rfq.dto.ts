import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class RerouteRfqDto {
  @ApiProperty({
    type: [String],
    description: 'New ServiceCategory ids to route the RFQ to.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  requestedCategoryIds!: string[];
}
