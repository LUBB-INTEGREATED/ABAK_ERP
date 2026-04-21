import { ApiProperty } from '@nestjs/swagger';
import { RfqDispatchChannel } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class DispatchRfqDto {
  @ApiProperty({ enum: RfqDispatchChannel })
  @IsEnum(RfqDispatchChannel)
  channel!: RfqDispatchChannel;
}
