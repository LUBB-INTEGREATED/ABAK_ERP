import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { ScopeUser } from '../auth/scope.util';
import { FilesService, type UploadedFileLike } from './files.service';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
// RV-4: SVG dropped from the allowlist — it is an active-content (XSS) vector
// when served inline. Raster images + PDF only.
export const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/;

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

export class UploadFileDto {
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

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a file (image or PDF). Stored on the active storage provider; returns the FileAsset whose url serves the bytes back.',
  })
  // TODO(spec): gate behind a dedicated upload permission once DM-12 splits the
  // RFQ/company-profile permissions; for now this matches the auth-only
  // convention of the existing register() endpoint.
  // RV-3: hard multer limit so the stream aborts mid-upload (LIMIT_FILE_SIZE)
  // instead of buffering an unbounded body into the heap. MaxFileSizeValidator
  // below stays as defense-in-depth.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES }),
          new FileTypeValidator({ fileType: ALLOWED_MIME }),
        ],
      }),
    )
    file: UploadedFileLike,
    @Body() dto: UploadFileDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.upload(file, dto, actorId);
  }

  @Public()
  @Get(':id/raw')
  @ApiOperation({
    summary:
      'Serve the raw bytes of a NON-sensitive file by id (public capability URL). client/quote/rfq assets are refused here — use the authenticated download route.',
  })
  async raw(@Param('id') id: string): Promise<StreamableFile> {
    // RV-20: public route refuses sensitive (client/quote/rfq) assets.
    const { asset, stream } = await this.service.openStored(id);
    return new StreamableFile(stream, {
      type: asset.mimeType,
      disposition: `inline; filename="${encodeURIComponent(asset.originalName)}"`,
      length: asset.sizeBytes,
    });
  }

  @Get(':id/download')
  @ApiOperation({
    summary:
      'Download a file (authenticated, per-asset ACL). For a private ' +
      'client/quote/rfq asset the caller must have scope on the owning record ' +
      '(the same object-level check as that resource’s detail route).',
  })
  // A-2 (IDOR FIX): re-run the owning-module object-level scope check before
  // streaming. Previously this passed allowSensitive:true with NO ACL, so any
  // authenticated user could download any client/quote/rfq asset by id.
  async download(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
  ): Promise<StreamableFile> {
    const { asset, stream } = await this.service.openForDownload(id, user);
    return new StreamableFile(stream, {
      type: asset.mimeType,
      disposition: `inline; filename="${encodeURIComponent(asset.originalName)}"`,
      length: asset.sizeBytes,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get()
  @ApiOperation({
    summary:
      'List files for a given owner resource. SR2-1: scope-checked — the ' +
      'caller must be able to access the owning record (or hold ALL scope), ' +
      'so this can no longer be used to enumerate another scope’s files.',
  })
  // SR2-1: pass the caller so listForOwner can re-run the per-asset ACL against
  // the queried owner before returning any rows (no blind enumeration).
  listForOwner(
    @Query('ownerResource') ownerResource: string,
    @Query('ownerResourceId') ownerResourceId: string,
    @CurrentUser() user: ScopeUser,
  ) {
    return this.service.listForOwner(ownerResource, ownerResourceId, user);
  }
}
