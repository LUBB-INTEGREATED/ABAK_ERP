import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentCategory, DocumentEntityType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PermissionsService,
  type PermissionScope,
} from '../auth/permissions.service';
import type { ScopeUser } from '../auth/scope.util';
import { ClientsService } from '../clients/clients.service';
import { FilesService, type UploadedFileLike } from '../files/files.service';
import {
  SAFE_STORAGE_KEY,
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../files/storage/storage.provider';
import { GovTransactionsService } from '../gov-transactions/gov-transactions.service';
import { LeadsService } from '../leads/leads.service';
import { ProjectsService } from '../projects/projects.service';
import { QuotesService } from '../quotes/quotes.service';

/**
 * WS-D / DOC-A — Document Control (Wave-0).
 *
 * Basic, entity-linked document management built ON TOP of the hardened files
 * store. The access decision lives HERE, keyed off the OWNING entity: a caller
 * may upload/list/download a document only if they can already see that entity
 * (we re-run the owning module's object-level `findOne(id, scopeCtx)`, which
 * throws 403/404 when out of scope). This mirrors files.service's per-asset ACL
 * but pivots on the business entity instead of the raw FileAsset owner string.
 *
 * Wave-0 scope: upload, categorise, list-by-entity, download, delete. NO
 * version/Rev/stamp/diff — that is the deferred DOC-B wave.
 */

/** The `*:view` permission whose data-scope gates each entity type. */
const ENTITY_VIEW_PERMISSION: Record<DocumentEntityType, string> = {
  PROJECT: 'project:view',
  GOV_TX: 'gov:view',
  QUOTE: 'quote:view',
  CLIENT: 'clients:view',
  LEAD: 'leads:view',
  FINANCE: 'finance:view',
};

/**
 * R2-10 — the WRITE/MANAGE permission whose presence gates DESTRUCTIVE document
 * ops (delete) on each entity type. Read scope (`*:view`) is NOT enough to
 * delete another user's document and its backing bytes: a caller must also hold
 * the owning module's edit/manage grant (or be the uploader — see remove()).
 * Mirrors the view-key map so the data-scope check still runs on the same key.
 */
const ENTITY_WRITE_PERMISSION: Record<DocumentEntityType, string> = {
  PROJECT: 'project:manage_tasks',
  GOV_TX: 'gov:manage',
  QUOTE: 'quote:build',
  CLIENT: 'clients:edit',
  LEAD: 'leads:edit',
  FINANCE: 'finance:manage_invoice',
};

/**
 * Entity types with a wired object-level resolver — the owning service's
 * `findOne(id, { user, scope })`. FINANCE has no per-record scoped resolver, so
 * (like files.service for payment/po/gov) it requires whole-class ALL scope.
 */
const OBJECT_RESOLVABLE: ReadonlySet<DocumentEntityType> = new Set([
  DocumentEntityType.PROJECT,
  DocumentEntityType.GOV_TX,
  DocumentEntityType.QUOTE,
  DocumentEntityType.CLIENT,
  DocumentEntityType.LEAD,
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly files: FilesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly projects: ProjectsService,
    private readonly gov: GovTransactionsService,
    private readonly quotes: QuotesService,
    private readonly clients: ClientsService,
    private readonly leads: LeadsService,
  ) {}

  /**
   * Re-run the OWNING entity's object-level scope check. Throws Forbidden/
   * NotFound when the caller can't see the entity — so a non-scoped user can
   * never list/download/upload another entity's documents (IDOR closed).
   */
  private async assertEntityAccess(
    entityType: DocumentEntityType,
    entityId: string,
    user: ScopeUser,
  ): Promise<void> {
    const permKey = ENTITY_VIEW_PERMISSION[entityType];
    const map = await this.permissions.resolveForUser(user.id);
    let scope: PermissionScope | undefined = map.get(permKey);
    const isManager = Boolean(user.managedDepartment?.id);
    if (!scope && isManager) {
      // A department manager sees their department's records even where the
      // explicit role grant is absent; the owning findOne enforces membership.
      scope = 'DEPARTMENT';
    }
    if (!scope) {
      throw new ForbiddenException(
        'You do not have permission to access this entity',
      );
    }

    if (OBJECT_RESOLVABLE.has(entityType)) {
      const scopeCtx = { user, scope };
      switch (entityType) {
        case DocumentEntityType.PROJECT:
          await this.projects.findOne(entityId, scopeCtx);
          return;
        case DocumentEntityType.GOV_TX:
          await this.gov.findOne(entityId, scopeCtx);
          return;
        case DocumentEntityType.QUOTE:
          await this.quotes.findOne(entityId, scopeCtx);
          return;
        case DocumentEntityType.CLIENT:
          await this.clients.findOne(entityId, scopeCtx);
          return;
        case DocumentEntityType.LEAD:
          await this.leads.findOne(entityId, scopeCtx);
          return;
        default:
          break;
      }
    }

    // FINANCE (no per-record resolver): require whole-class ALL scope.
    if (scope !== 'ALL') {
      throw new ForbiddenException(
        'You do not have permission to access this entity',
      );
    }
  }

  /**
   * Upload a file and register it as a Document on the given entity.
   *
   * Pipeline: store bytes + create the FileAsset via the existing files upload
   * (no ownerResource → the asset is private + fail-closed on the public /raw
   * route), THEN stamp the FileAsset with ownerResource=entityType +
   * ownerResourceId=entityId for traceability, THEN create the Document row.
   * Access is enforced FIRST: only a user scoped to the owning entity may upload.
   */
  async upload(
    file: UploadedFileLike,
    input: {
      entityType: DocumentEntityType;
      entityId: string;
      category?: DocumentCategory;
      title?: string;
    },
    user: ScopeUser,
  ) {
    await this.assertEntityAccess(input.entityType, input.entityId, user);

    // Store + register the asset (private; no public ownerResource).
    const asset = await this.files.upload(file, {}, user.id);

    // Stamp the asset with the owning entity for traceability + to keep it off
    // the public /raw route (isPublic stays false). We write the entity-type
    // owner directly (it is NOT one of files' fixed ownerResource values; access
    // for documents is enforced by this service, not the files ACL).
    await this.prisma.fileAsset.update({
      where: { id: asset.id },
      data: {
        ownerResource: input.entityType,
        ownerResourceId: input.entityId,
        isPublic: false,
      },
    });

    return this.prisma.document.create({
      data: {
        fileAssetId: asset.id,
        entityType: input.entityType,
        entityId: input.entityId,
        category: input.category ?? DocumentCategory.OTHER,
        title: input.title?.trim() || file.originalname,
        uploadedById: user.id,
      },
      include: { fileAsset: true },
    });
  }

  /** List an entity's documents — scope-checked against the owning entity. */
  async listForEntity(
    entityType: DocumentEntityType,
    entityId: string,
    user: ScopeUser,
    category?: DocumentCategory,
  ) {
    await this.assertEntityAccess(entityType, entityId, user);
    return this.prisma.document.findMany({
      where: { entityType, entityId, ...(category ? { category } : {}) },
      include: { fileAsset: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Open a document's bytes for download — scope-checked against the document's
   * OWNING entity, then streamed straight from the storage provider. We do NOT
   * route through files.openForDownload because that ACL fails closed for our
   * entity-type owner strings; the entity scope check here is the access gate.
   */
  async openForDownload(id: string, user: ScopeUser) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { fileAsset: true },
    });
    if (!doc) throw new NotFoundException();
    await this.assertEntityAccess(doc.entityType, doc.entityId, user);
    const key = doc.fileAssetId;
    if (!SAFE_STORAGE_KEY.test(key) || !(await this.storage.exists(key))) {
      throw new NotFoundException();
    }
    const stream = await this.storage.createReadStream(key);
    return { asset: doc.fileAsset, stream };
  }

  /**
   * Delete a document (and its backing bytes).
   *
   * R2-10 — destructive op, so gated by WRITE access, not mere read scope:
   *   1. the per-entity view-scope check still runs (closes IDOR — caller must
   *      be able to see the owning entity), THEN
   *   2. the caller must EITHER hold the owning entity's edit/manage permission
   *      OR be the original uploader. A user who can only VIEW an entity can no
   *      longer permanently delete documents others uploaded.
   */
  async remove(id: string, user: ScopeUser) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    await this.assertEntityAccess(doc.entityType, doc.entityId, user);

    const isUploader = doc.uploadedById != null && doc.uploadedById === user.id;
    if (!isUploader) {
      const writeKey = ENTITY_WRITE_PERMISSION[doc.entityType];
      const map = await this.permissions.resolveForUser(user.id);
      if (!map.has(writeKey)) {
        throw new ForbiddenException(
          'You do not have permission to delete this document',
        );
      }
    }
    // Cascade on the FK removes the Document row when the FileAsset goes; delete
    // the asset row + its bytes so no orphan is left behind.
    await this.prisma.document.delete({ where: { id } });
    await this.prisma.fileAsset
      .delete({ where: { id: doc.fileAssetId } })
      .catch(() => undefined);
    await this.storage.delete(doc.fileAssetId).catch(() => undefined);
    return { ok: true };
  }
}
