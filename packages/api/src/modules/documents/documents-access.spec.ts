import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm } from 'node:fs/promises';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PermissionsService } from '../auth/permissions.service';
import type { GovTransactionsService } from '../gov-transactions/gov-transactions.service';
import type { LeadsService } from '../leads/leads.service';
import type { ProjectsService } from '../projects/projects.service';
import type { QuotesService } from '../quotes/quotes.service';
import type { RfqsService } from '../rfqs/rfqs.service';
import type { ScopeUser } from '../auth/scope.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
import { FilesService, type UploadedFileLike } from '../files/files.service';
import { LocalDiskStorageProvider } from '../files/storage/local-disk.storage';
import { DocumentsService } from './documents.service';

// WS-D / DOC-A regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). It proves the Document Control access model:
//   - upload stamps the owning FileAsset (ownerResource=entityType,
//     ownerResourceId=entityId, isPublic=false);
//   - list returns the entity's documents to a scoped caller;
//   - a non-scoped user can NOT list / download another entity's documents
//     (the IDOR check), even though the row exists.
// We exercise the CLIENT entity (OWN scope = accountManagerId match) because it
// is the cheapest entity to seed; the same assertEntityAccess path serves every
// entity type.

const ROOT = `/tmp/docA-store-${process.pid}`;
const config = {
  get: (key: string) =>
    key === 'app.uploadDir'
      ? ROOT
      : key === 'app.globalPrefix'
        ? 'api/v1'
        : undefined,
} as unknown as ConfigService;

const prisma = new PrismaService();
const storage = new LocalDiskStorageProvider(config);
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const audit = { log: async () => undefined } as unknown as AuditService;
const clients = new ClientsService(prisma, notifications, audit);
const files = new FilesService(
  prisma,
  config,
  storage,
  {} as unknown as PermissionsService,
  clients,
  {} as unknown as QuotesService,
  {} as unknown as RfqsService,
);

// Stubbed entity services we don't drive in these CLIENT-scoped tests.
const projects = {} as unknown as ProjectsService;
const gov = {} as unknown as GovTransactionsService;
const quotes = {} as unknown as QuotesService;
const leads = {} as unknown as LeadsService;

/**
 * Build a DocumentsService whose PermissionsService grants `clients:view` at the
 * given scope to EVERY user. Object-level access is then decided by the clients
 * findOne ownership check, exactly like production.
 */
function makeService(scope: 'OWN' | 'ALL'): DocumentsService {
  const permissions = {
    resolveForUser: async () => new Map([['clients:view', scope]]),
  } as unknown as PermissionsService;
  return new DocumentsService(
    prisma,
    permissions,
    files,
    storage,
    projects,
    gov,
    quotes,
    clients,
    leads,
  );
}

const ownService = makeService('OWN');
const allService = makeService('ALL');

const TAG = `DOCA-${Date.now()}`;
const trash = {
  userIds: [] as string[],
  clientIds: [] as string[],
  assetIds: [] as string[],
  documentIds: [] as string[],
};

after(async () => {
  for (const id of trash.documentIds) {
    await prisma.document.deleteMany({ where: { id } });
  }
  for (const id of trash.assetIds) {
    await storage.delete(id).catch(() => undefined);
    await prisma.fileAsset.deleteMany({ where: { id } });
  }
  for (const id of trash.clientIds) {
    await prisma.client.deleteMany({ where: { id } });
  }
  for (const id of trash.userIds) {
    await prisma.user.deleteMany({ where: { id } });
  }
  await rm(ROOT, { recursive: true, force: true });
  await prisma.$disconnect();
});

async function seedUser(label: string): Promise<ScopeUser> {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}-${label}-${trash.userIds.length}@example.com`,
      password: 'x',
      firstName: label,
      status: 'ACTIVE',
    },
    select: { id: true, departmentId: true },
  });
  trash.userIds.push(u.id);
  return { id: u.id, departmentId: u.departmentId, managedDepartment: null };
}

async function seedClient(managerId: string): Promise<string> {
  const client = await prisma.client.create({
    data: {
      clientNumber: `${TAG}-${trash.clientIds.length}`,
      contactName: `${TAG}-contact`,
      phone: `+9665${(Date.now() + trash.clientIds.length).toString().slice(-8)}`,
      accountManagerId: managerId,
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);
  return client.id;
}

const pdf = (name: string): UploadedFileLike => ({
  originalname: name,
  mimetype: 'application/pdf',
  size: 4,
  buffer: Buffer.from('%PDF'),
});

test('DOC-A: upload stamps the FileAsset owner + creates a Document row', async () => {
  const owner = await seedUser('owner');
  const clientId = await seedClient(owner.id);

  const doc = await ownService.upload(
    pdf('deed.pdf'),
    { entityType: 'CLIENT', entityId: clientId, category: 'CONTRACT', title: 'Deed' },
    owner,
  );
  trash.documentIds.push(doc.id);
  trash.assetIds.push(doc.fileAssetId);

  assert.equal(doc.entityType, 'CLIENT');
  assert.equal(doc.entityId, clientId);
  assert.equal(doc.category, 'CONTRACT');
  assert.equal(doc.title, 'Deed');

  // The backing FileAsset is stamped with the entity owner + kept private.
  const asset = await prisma.fileAsset.findUnique({
    where: { id: doc.fileAssetId },
  });
  assert.ok(asset, 'the FileAsset exists');
  assert.equal(asset!.ownerResource, 'CLIENT', 'ownerResource = entityType');
  assert.equal(asset!.ownerResourceId, clientId, 'ownerResourceId = entityId');
  assert.equal(asset!.isPublic, false, 'never public — off the /raw route');
});

test('DOC-A: list returns the entity documents to a scoped caller', async () => {
  const owner = await seedUser('lister');
  const clientId = await seedClient(owner.id);

  const doc = await ownService.upload(
    pdf('plan.pdf'),
    { entityType: 'CLIENT', entityId: clientId, category: 'ARCHITECTURAL' },
    owner,
  );
  trash.documentIds.push(doc.id);
  trash.assetIds.push(doc.fileAssetId);
  // title falls back to the original filename when none is given.
  assert.equal(doc.title, 'plan.pdf');

  const list = await ownService.listForEntity('CLIENT', clientId, owner);
  assert.ok(
    list.some((d) => d.id === doc.id),
    'the owner sees the document in the list',
  );

  // category filter narrows the list.
  const filtered = await ownService.listForEntity(
    'CLIENT',
    clientId,
    owner,
    'FINANCIAL',
  );
  assert.equal(
    filtered.length,
    0,
    'a category with no docs returns an empty list',
  );
});

test('DOC-A (IDOR): a non-scoped user cannot list or download another entity’s docs', async () => {
  const owner = await seedUser('victim');
  const attacker = await seedUser('attacker');
  const clientId = await seedClient(owner.id);

  const doc = await ownService.upload(
    pdf('secret.pdf'),
    { entityType: 'CLIENT', entityId: clientId, category: 'OTHER' },
    owner,
  );
  trash.documentIds.push(doc.id);
  trash.assetIds.push(doc.fileAssetId);

  // The owner (OWN scope on a client they manage) can download it.
  const ok = await ownService.openForDownload(doc.id, owner);
  assert.equal(ok.asset.id, doc.fileAssetId, 'the owner downloads their doc');

  // The attacker holds clients:view OWN but is NOT the account manager → 403.
  await assert.rejects(
    () => ownService.listForEntity('CLIENT', clientId, attacker),
    /permission|access/i,
    'a non-scoped user cannot list another entity’s docs',
  );
  await assert.rejects(
    () => ownService.openForDownload(doc.id, attacker),
    /permission|access/i,
    'a non-scoped user cannot download another entity’s doc (IDOR closed)',
  );

  // An attacker can't upload onto an entity they can't see, either.
  await assert.rejects(
    () =>
      ownService.upload(
        pdf('inject.pdf'),
        { entityType: 'CLIENT', entityId: clientId },
        attacker,
      ),
    /permission|access/i,
    'a non-scoped user cannot upload onto another entity',
  );
});

test('DOC-A: an ALL-scope viewer can list + download any entity’s docs', async () => {
  const owner = await seedUser('owner3');
  const clientId = await seedClient(owner.id);
  const doc = await ownService.upload(
    pdf('shared.pdf'),
    { entityType: 'CLIENT', entityId: clientId },
    owner,
  );
  trash.documentIds.push(doc.id);
  trash.assetIds.push(doc.fileAssetId);

  const admin = await seedUser('admin');
  const list = await allService.listForEntity('CLIENT', clientId, admin);
  assert.ok(list.some((d) => d.id === doc.id), 'ALL scope lists any docs');
  const dl = await allService.openForDownload(doc.id, admin);
  assert.equal(dl.asset.id, doc.fileAssetId, 'ALL scope downloads any doc');
});

test('DOC-A: delete removes the document + its bytes (scope-checked)', async () => {
  const owner = await seedUser('deleter');
  const attacker = await seedUser('del-attacker');
  const clientId = await seedClient(owner.id);
  const doc = await ownService.upload(
    pdf('tmp.pdf'),
    { entityType: 'CLIENT', entityId: clientId },
    owner,
  );

  // A non-scoped user cannot delete it.
  await assert.rejects(
    () => ownService.remove(doc.id, attacker),
    /permission|access/i,
    'a non-scoped user cannot delete another entity’s doc',
  );

  // The owner deletes it; the row + bytes are gone.
  const res = await ownService.remove(doc.id, owner);
  assert.equal(res.ok, true);
  const gone = await prisma.document.findUnique({ where: { id: doc.id } });
  assert.equal(gone, null, 'the document row is deleted');
  const assetGone = await prisma.fileAsset.findUnique({
    where: { id: doc.fileAssetId },
  });
  assert.equal(assetGone, null, 'the backing FileAsset is deleted');
  assert.equal(
    await storage.exists(doc.fileAssetId),
    false,
    'the stored bytes are removed',
  );
});
