import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SAFE_STORAGE_KEY,
  STORAGE_PROVIDER,
  type StorageProvider,
} from './storage/storage.provider';

/**
 * RV-20: assets owned by these resources are confidential and must not be
 * served over the @Public raw capability URL.
 */
const SENSITIVE_OWNER_RESOURCES = ['client', 'quote', 'rfq'];

export interface RegisterFileInput {
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  ownerResource?: string;
  ownerResourceId?: string;
}

/** A multipart upload as exposed by Nest's `FileInterceptor` (memory storage). */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadFileInput {
  ownerResource?: string;
  ownerResourceId?: string;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  register(input: RegisterFileInput, uploadedById?: string) {
    return this.prisma.fileAsset.create({
      data: {
        url: input.url,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        ownerResource: input.ownerResource,
        ownerResourceId: input.ownerResourceId,
        uploadedById,
      },
    });
  }

  /**
   * Store uploaded bytes and register the `FileAsset`. The stored object is
   * keyed by the asset id, and the asset URL points back at the raw-serve
   * route, so a browser-uploaded image is retrievable by URL.
   */
  async upload(
    file: UploadedFileLike,
    input: UploadFileInput,
    uploadedById?: string,
  ) {
    const id = randomUUID();
    await this.storage.save(id, file.buffer);
    const prefix = this.config.get<string>('app.globalPrefix') ?? 'api/v1';
    return this.prisma.fileAsset.create({
      data: {
        id,
        url: `/${prefix}/files/${id}/raw`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        ownerResource: input.ownerResource,
        ownerResourceId: input.ownerResourceId,
        uploadedById,
      },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    return asset;
  }

  /** Resolve a stored asset + open its byte stream for the raw-serve route. */
  async openStored(id: string, opts: { allowSensitive?: boolean } = {}) {
    if (!SAFE_STORAGE_KEY.test(id)) throw new NotFoundException();
    const asset = await this.findOne(id);
    // RV-20: confidential assets (client docs, quote PDFs, RFQ attachments) are
    // not served over the @Public capability URL — the unguessable id is no
    // longer a permanent public bearer for them; they need an authed route.
    if (
      !opts.allowSensitive &&
      asset.ownerResource &&
      SENSITIVE_OWNER_RESOURCES.includes(asset.ownerResource)
    ) {
      throw new ForbiddenException(
        'This file is private and requires authentication',
      );
    }
    if (!(await this.storage.exists(id))) {
      // Registered-by-URL assets have no stored bytes.
      throw new NotFoundException();
    }
    const stream = await this.storage.createReadStream(id);
    return { asset, stream };
  }

  listForOwner(ownerResource: string, ownerResourceId: string) {
    return this.prisma.fileAsset.findMany({
      where: { ownerResource, ownerResourceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
