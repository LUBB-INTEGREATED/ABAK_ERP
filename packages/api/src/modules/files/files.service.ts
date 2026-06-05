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
  PermissionsService,
  type PermissionScope,
} from '../auth/permissions.service';
import type { ScopeUser } from '../auth/scope.util';
import { ClientsService } from '../clients/clients.service';
import { QuotesService } from '../quotes/quotes.service';
import { RfqsService } from '../rfqs/rfqs.service';
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

/**
 * A-2: the `view` permission key whose data-scope gates each sensitive owner
 * resource, used to re-run the owning-module object-level scope check before
 * streaming a private asset.
 */
const OWNER_RESOURCE_VIEW_PERMISSION: Record<string, string> = {
  client: 'clients:view',
  quote: 'quotes:view',
  rfq: 'rfqs:view',
};

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
    private readonly permissions: PermissionsService,
    private readonly clients: ClientsService,
    private readonly quotes: QuotesService,
    private readonly rfqs: RfqsService,
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

  /**
   * A-2 (IDOR FIX): authenticated download with a per-asset ACL. Before
   * streaming a confidential asset we re-run the OWNING module's object-level
   * scope check: a `client`/`quote`/`rfq` asset is served only if the caller
   * could see that resource via its own detail route. Previously the route
   * passed `allowSensitive:true` with NO ownership check, so any authenticated
   * user could pull any client/quote/RFQ attachment by guessing/enumerating an
   * id. Non-sensitive assets are served to any authenticated user (same as the
   * public raw route, just authenticated).
   */
  async openForDownload(id: string, user: ScopeUser) {
    if (!SAFE_STORAGE_KEY.test(id)) throw new NotFoundException();
    const asset = await this.findOne(id);
    await this.assertResourceAccess(asset, user);
    if (!(await this.storage.exists(id))) {
      // Registered-by-URL assets have no stored bytes.
      throw new NotFoundException();
    }
    const stream = await this.storage.createReadStream(id);
    return { asset, stream };
  }

  /**
   * A-2: assert the caller may access a sensitive asset by deferring to the
   * owning module's `findOne(ownerResourceId, scopeCtx)`, which throws
   * Forbidden/NotFound when the caller lacks scope on that record. A sensitive
   * asset with no `ownerResourceId` cannot be ownership-checked, so it is denied
   * for any non-ALL caller (fail closed). Resources we don't recognise are
   * treated as sensitive-unknown and denied.
   */
  private async assertResourceAccess(
    asset: { ownerResource: string | null; ownerResourceId: string | null },
    user: ScopeUser,
  ): Promise<void> {
    const ownerResource = asset.ownerResource;
    if (!ownerResource || !SENSITIVE_OWNER_RESOURCES.includes(ownerResource)) {
      // Non-sensitive (or unowned) asset: authentication is sufficient.
      return;
    }

    // Resolve the caller's data-scope for the matching view permission. No
    // grant at all ⇒ they cannot view this resource type ⇒ deny.
    const permKey = OWNER_RESOURCE_VIEW_PERMISSION[ownerResource];
    const map = await this.permissions.resolveForUser(user.id);
    const isManager = Boolean(user.managedDepartment?.id);
    let scope: PermissionScope | undefined = map.get(permKey);
    if (!scope && isManager) {
      // A department manager sees their department's records (DEPARTMENT scope)
      // even where the role grant is absent; the owning findOne enforces the
      // actual department membership.
      scope = 'DEPARTMENT';
    }
    if (!scope) {
      throw new ForbiddenException(
        'You do not have permission to access this file',
      );
    }

    if (!asset.ownerResourceId) {
      // Can't prove ownership of an asset with no owner id: fail closed unless
      // the caller is unrestricted (ALL).
      if (scope === 'ALL') return;
      throw new ForbiddenException(
        'You do not have permission to access this file',
      );
    }

    const scopeCtx = { user, scope };
    // The owning findOne throws Forbidden (out of scope) or NotFound (missing).
    if (ownerResource === 'client') {
      await this.clients.findOne(asset.ownerResourceId, scopeCtx);
    } else if (ownerResource === 'quote') {
      await this.quotes.findOne(asset.ownerResourceId, scopeCtx);
    } else if (ownerResource === 'rfq') {
      await this.rfqs.findOne(asset.ownerResourceId, scopeCtx);
    }
  }

  listForOwner(ownerResource: string, ownerResourceId: string) {
    return this.prisma.fileAsset.findMany({
      where: { ownerResource, ownerResourceId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
