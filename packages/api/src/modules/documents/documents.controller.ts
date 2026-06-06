import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { ScopeUser } from '../auth/scope.util';
import type { UploadedFileLike } from '../files/files.service';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, ListDocumentsDto } from './dto';

/** WS-D / DOC-A — 25MB per document (vs the 10MB generic files limit). */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Accepted document types for an engineering office: PDF, raster images, DWG
 * (CAD), and ZIP archives. DWG/ZIP have no single canonical mime (browsers send
 * application/octet-stream / application/acad / application/zip / …), so we
 * allow the broad set and additionally accept by extension as a fallback. The
 * type list is intentionally wider than files' raster+PDF allowlist because
 * documents are downloaded (attachment) — never served inline as active content.
 */
const ALLOWED_DOC_MIME =
  /^(application\/pdf|image\/(png|jpe?g|webp|gif)|application\/zip|application\/x-zip-compressed|application\/acad|image\/vnd\.dwg|application\/dwg|application\/x-dwg|application\/octet-stream)$/;
const ALLOWED_DOC_EXT = /\.(pdf|png|jpe?g|webp|gif|dwg|zip)$/i;

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a document (PDF/DWG/ZIP/image, ≤25MB) onto an entity. Scope-checked: ' +
      'only a caller who can access the owning entity may upload.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_DOCUMENT_BYTES })],
      }),
    )
    file: UploadedFileLike,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: ScopeUser,
  ) {
    // Type allowlist: accept by mime OR by extension (DWG/ZIP mimes are
    // inconsistent across browsers). Reject anything matching neither.
    const okMime = ALLOWED_DOC_MIME.test(file.mimetype ?? '');
    const okExt = ALLOWED_DOC_EXT.test(file.originalname ?? '');
    if (!okMime && !okExt) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: PDF, DWG, ZIP, images.',
      );
    }
    return this.service.upload(
      file,
      {
        entityType: dto.entityType,
        entityId: dto.entityId,
        category: dto.category,
        title: dto.title,
      },
      user,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'List documents for an entity (scope-checked against the owning entity).',
  })
  list(@Query() query: ListDocumentsDto, @CurrentUser() user: ScopeUser) {
    return this.service.listForEntity(
      query.entityType,
      query.entityId,
      user,
      query.category,
    );
  }

  @Get(':id/download')
  @ApiOperation({
    summary:
      'Download a document (authenticated; scope-checked against its owning entity).',
  })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
  ): Promise<StreamableFile> {
    const { asset, stream } = await this.service.openForDownload(id, user);
    return new StreamableFile(stream, {
      type: asset.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(asset.originalName)}"`,
      length: asset.sizeBytes,
    });
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a document (scope-checked against its owning entity).',
  })
  remove(@Param('id') id: string, @CurrentUser() user: ScopeUser) {
    return this.service.remove(id, user);
  }
}
