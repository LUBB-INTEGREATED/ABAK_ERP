import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory, DocumentEntityType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * WS-D / DOC-A — multipart upload body. The actual file rides as the `file`
 * multipart part (validated by the controller's ParseFilePipe); these scalar
 * fields describe WHICH entity the document belongs to and HOW to classify it.
 */
export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentEntityType })
  @IsEnum(DocumentEntityType)
  entityType!: DocumentEntityType;

  @ApiProperty({ description: 'Id of the owning entity (project/gov-tx/…).' })
  @IsString()
  entityId!: string;

  @ApiPropertyOptional({ enum: DocumentCategory, default: DocumentCategory.OTHER })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({
    description: 'Display title; falls back to the original filename.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

/** WS-D — query for listing documents of a single entity. */
export class ListDocumentsDto {
  @ApiProperty({ enum: DocumentEntityType })
  @IsEnum(DocumentEntityType)
  entityType!: DocumentEntityType;

  @ApiProperty()
  @IsString()
  entityId!: string;

  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
}
