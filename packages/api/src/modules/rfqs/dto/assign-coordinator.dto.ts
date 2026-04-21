import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignCoordinatorDto {
  @ApiProperty()
  @IsString()
  coordinatorId!: string;
}
