import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
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
 * SR2-2 / SR2-3: the fixed vocabulary of owner resources an asset may declare.
 * Upload validates `ownerResource` against this set so an unknown/typo'd value
 * cannot smuggle an asset past the ACL by failing the sensitive-owner lookup.
 * `null` (no owner) is also valid and is treated as NON-public, NON-listable,
 * download-gated to ALL-scope only — i.e. fail-closed.
 */
export const KNOWN_OWNER_RESOURCES = [
  'client',
  'quote',
  'rfq',
  'payment',
  'po',
  'gov',
  'logo',
  'public-asset',
] as const;
export type OwnerResource = (typeof KNOWN_OWNER_RESOURCES)[number];

/**
 * SR2-3: owner resources for which we have a wired object-level scope resolver
 * (the owning module's `findOne(ownerResourceId, scopeCtx)`). An asset of any
 * OTHER owner type — payment/po/gov, an unknown value, or a null owner — has NO
 * wired resolver and is therefore DENIED on /download unless the caller is
 * ALL-scoped (admin). This is the default-deny posture: we never fall through
 * to "authentication is sufficient" for a non-public asset.
 */
const SCOPE_RESOLVABLE_OWNER_RESOURCES = ['client', 'quote', 'rfq'];

/**
 * A-2 / SR2-3: the `view` permission key whose data-scope gates each
 * scope-resolvable owner resource, used to re-run the owning-module
 * object-level scope check before streaming a private asset.
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

/**
 * SR2-3: reject any `ownerResource` not in the fixed vocabulary. A `null`/absent
 * owner is allowed (a generic upload) — it is treated as private+fail-closed by
 * the ACL — but a non-empty unknown string is a misconfiguration and is refused
 * so it can never sneak past the sensitive-owner lookup as "non-sensitive".
 */
function assertOwnerResource(ownerResource: string | undefined | null): void {
  if (
    ownerResource != null &&
    ownerResource !== '' &&
    !(KNOWN_OWNER_RESOURCES as readonly string[]).includes(ownerResource)
  ) {
    throw new BadRequestException(`Unknown ownerResource: ${ownerResource}`);
  }
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
    assertOwnerResource(input.ownerResource);
    return this.prisma.fileAsset.create({
      data: {
        url: input.url,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        ownerResource: input.ownerResource,
        ownerResourceId: input.ownerResourceId,
        // SR2-2: registered assets are private by default; an explicitly
        // public asset (logo/public-asset) is the only thing /raw serves.
        isPublic:
          input.ownerResource === 'logo' ||
          input.ownerResource === 'public-asset',
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
    // SR2-3: validate the declared owner against the fixed vocabulary BEFORE we
    // persist any bytes, so a bad/unknown owner can't be stored at all.
    assertOwnerResource(input.ownerResource);
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
        // SR2-2: default-deny on /raw. A web upload (RFQ doc-request attach)
        // posts no ownerResource → isPublic stays false → /raw refuses it. Only
        // an explicit logo/public-asset upload is served publicly.
        isPublic:
          input.ownerResource === 'logo' ||
          input.ownerResource === 'public-asset',
        uploadedById,
      },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    return asset;
  }

  /**
   * Resolve a stored asset + open its byte stream for the @Public /raw route.
   *
   * SR2-2 (DEFAULT-DENY): /raw is an UNAUTHENTICATED capability URL, so it now
   * serves ONLY assets EXPLICITLY flagged `isPublic` (e.g. the company logo /
   * a public marketing asset). Anything else — a client/quote/rfq doc, a
   * payment/PO/gov doc, AND a null/unknown-owner upload (which is what an RFQ
   * doc-request web attach produces) — is refused here. The previous behaviour
   * (serve unless owner ∈ {client,quote,rfq}) leaked every other owner type and
   * every null-owner upload to anyone with the id; it is gone.
   *
   * The `opts.allowSensitive` escape hatch is removed: there is no longer any
   * "serve a private asset over the public route" path. Private assets are
   * served only by the authenticated, ACL-gated {@link openForDownload}.
   */
  async openStored(id: string) {
    if (!SAFE_STORAGE_KEY.test(id)) throw new NotFoundException();
    const asset = await this.findOne(id);
    if (!asset.isPublic) {
      // 404 (not 403) so the public route does not confirm the id even exists.
      throw new NotFoundException();
    }
    if (!(await this.storage.exists(id))) {
      // Registered-by-URL assets have no stored bytes.
      throw new NotFoundException();
    }
    const stream = await this.storage.createReadStream(id);
    return { asset, stream };
  }

  /**
   * SR2-3 (DEFAULT-DENY DOWNLOAD): authenticated download with a per-asset ACL.
   *
   * The route is NOT @Public, so a valid JWT is already required by the global
   * guard. On top of that, {@link assertResourceAccess} now fails CLOSED for
   * EVERY asset that isn't explicitly public:
   *   - client/quote/rfq  → re-run the owning module's object-level scope check
   *   - payment/po/gov     → require ALL scope on that module's view permission
   *   - null/unknown owner → require *some* ALL-scope grant (admin) — never the
   *                          old "authentication is sufficient" fall-through.
   * Previously any authenticated user could pull any non-{client,quote,rfq}
   * asset (payment/PO/gov/null) by id; that hole is closed.
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
   * SR2-3: default-deny per-asset ACL.
   *
   * 1. `isPublic` asset → anyone authenticated may download it.
   * 2. client/quote/rfq → defer to the owning module's
   *    `findOne(ownerResourceId, scopeCtx)`, which throws Forbidden/NotFound
   *    when the caller lacks scope. No owner id ⇒ can't prove ownership ⇒ deny
   *    unless the caller is ALL on that resource (fail closed).
   * 3. payment/po/gov (no wired object resolver) → require ALL scope on the
   *    module's view permission (whole-class access). A non-ALL caller is denied.
   * 4. null / unknown owner → require *some* ALL-scope grant (admin) and deny
   *    everyone else. We never assume "authentication is sufficient".
   */
  private async assertResourceAccess(
    asset: {
      ownerResource: string | null;
      ownerResourceId: string | null;
      isPublic?: boolean;
    },
    user: ScopeUser,
  ): Promise<void> {
    // (1) Explicitly public: any authenticated caller may download it.
    if (asset.isPublic) return;

    const ownerResource = asset.ownerResource;
    const map = await this.permissions.resolveForUser(user.id);
    const isManager = Boolean(user.managedDepartment?.id);

    // (2) Owner types we can object-level scope-check via the owning findOne.
    if (
      ownerResource &&
      SCOPE_RESOLVABLE_OWNER_RESOURCES.includes(ownerResource)
    ) {
      const permKey = OWNER_RESOURCE_VIEW_PERMISSION[ownerResource];
      let scope: PermissionScope | undefined = map.get(permKey);
      if (!scope && isManager) {
        // A department manager sees their department's records even where the
        // role grant is absent; the owning findOne enforces the membership.
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
      return;
    }

    // (3) Sensitive owner types with NO wired object resolver (payment/po/gov):
    // require ALL scope on the owning module's view permission. Without a
    // per-record resolver we cannot do object-level scope, so whole-class
    // (ALL) access is the floor — anything less is denied.
    const classViewPermission: Record<string, string> = {
      payment: 'finance:view',
      po: 'finance:view',
      gov: 'gov:view',
    };
    if (ownerResource && classViewPermission[ownerResource]) {
      if (map.get(classViewPermission[ownerResource]) === 'ALL') return;
      throw new ForbiddenException(
        'You do not have permission to access this file',
      );
    }

    // (4) null owner OR an owner string we don't recognise: fail closed. Only an
    // admin (a holder of ANY ALL-scope grant) may pull an unclassified asset.
    if (this.hasAnyAllScope(map)) return;
    throw new ForbiddenException(
      'You do not have permission to access this file',
    );
  }

  /** True if the caller holds at least one permission at ALL scope (admin-ish). */
  private hasAnyAllScope(map: Map<string, PermissionScope>): boolean {
    for (const scope of map.values()) {
      if (scope === 'ALL') return true;
    }
    return false;
  }

  /**
   * SR2-1 (NO BLIND ENUMERATION): list assets for an owner resource, but only
   * after the caller proves they can access that owning record. We defer to the
   * SAME object-level check {@link assertResourceAccess} uses, by constructing a
   * synthetic asset with the queried owner and running the ACL. If it throws,
   * the caller can't enumerate this owner's files. Owner types without a wired
   * resolver fall through to the ALL-scope/admin requirement, so a non-admin
   * cannot enumerate payment/po/gov/unknown files either.
   */
  async listForOwner(
    ownerResource: string,
    ownerResourceId: string,
    user: ScopeUser,
  ) {
    assertOwnerResource(ownerResource);
    await this.assertResourceAccess(
      { ownerResource, ownerResourceId, isPublic: false },
      user,
    );
    return this.prisma.fileAsset.findMany({
      where: { ownerResource, ownerResourceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * SR2-2: stamp an existing FileAsset as owned by an RFQ. Called server-side
   * when an RFQ doc-request is resolved with an attachment whose URL points at
   * one of our /files/:id/raw assets. The web upload posts no ownerResource, so
   * without this the attachment would persist as a null-owner asset; stamping it
   * 'rfq' makes the download ACL recognise it as sensitive and keeps it off the
   * public /raw route (which already refuses non-public assets).
   */
  async stampOwner(
    fileId: string,
    ownerResource: OwnerResource,
    ownerResourceId: string,
  ): Promise<void> {
    if (!SAFE_STORAGE_KEY.test(fileId)) return;
    await this.prisma.fileAsset.updateMany({
      where: { id: fileId },
      data: { ownerResource, ownerResourceId, isPublic: false },
    });
  }
}
