import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FilesService } from './files.service';

export class RegisterFileDto {
  @ApiProperty()
  @IsString()
  url!: string;

  @ApiProperty()
  @IsString()
  originalName!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerResource?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerResourceId?: string;
}

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Register a file asset. The URL can point to S3 / CDN / any reachable location.',
  })
  register(@Body() dto: RegisterFileDto, @CurrentUser('id') actorId: string) {
    return this.service.register(dto, actorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get()
  @ApiOperation({ summary: 'List files for a given owner resource' })
  listForOwner(
    @Query('ownerResource') ownerResource: string,
    @Query('ownerResourceId') ownerResourceId: string,
  ) {
    return this.service.listForOwner(ownerResource, ownerResourceId);
  }
}
