import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm } from 'node:fs/promises';
import type { ConfigService } from '@nestjs/config';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PermissionsService } from '../auth/permissions.service';
import type { QuotesService } from '../quotes/quotes.service';
import type { RfqsService } from '../rfqs/rfqs.service';
import type { ScopeUser } from '../auth/scope.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { FilesService, type UploadedFileLike } from './files.service';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';

// A-2 (IDOR) regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). GET /files/:id/download previously served any sensitive
// client/quote/rfq asset to any authenticated user with no per-asset ACL. The
// fix re-runs the owning module's object-level scope check before streaming.
// This asserts user B (OWN scope, NOT the client's account manager) is REFUSED
// the download of user A's client-owned asset, while user A (the manager) and
// an ALL-scope viewer succeed.

const ROOT = `/tmp/a2-acl-store-${process.pid}`;
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
const clients = new ClientsService(prisma, notifications);

// Both real users hold clients:view at OWN scope: they pass the permission
// gate, so the ownership check is what decides access.
const permissions = {
  resolveForUser: async () => new Map([['clients:view', 'OWN']]),
} as unknown as PermissionsService;
const quotes = {} as unknown as QuotesService;
const rfqs = {} as unknown as RfqsService;

const service = new FilesService(
  prisma,
  config,
  storage,
  permissions,
  clients,
  quotes,
  rfqs,
);

const TAG = `A2-${Date.now()}`;
const trash = {
  userIds: [] as string[],
  clientIds: [] as string[],
  assetIds: [] as string[],
};

after(async () => {
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

async function seedClientOwnedAsset(managerId: string): Promise<string> {
  const client = await prisma.client.create({
    data: {
      clientNumber: `${TAG}-${trash.clientIds.length}`,
      contactName: `${TAG}-contact`,
      phone: `+9665${Date.now().toString().slice(-8)}`,
      accountManagerId: managerId,
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);

  const file: UploadedFileLike = {
    originalname: 'contract.pdf',
    mimetype: 'application/pdf',
    size: 4,
    buffer: Buffer.from('%PDF'),
  };
  const asset = await service.upload(file, {
    ownerResource: 'client',
    ownerResourceId: client.id,
  });
  trash.assetIds.push(asset.id);
  return asset.id;
}

test('A-2: user B (OWN scope, not the manager) cannot download user A’s client asset', async () => {
  const userA = await seedUser('owner');
  const userB = await seedUser('attacker');
  const assetId = await seedClientOwnedAsset(userA.id);

  // The owning account manager (OWN scope) downloads their own asset.
  const ok = await service.openForDownload(assetId, {
    ...userA,
    // The download path resolves scope from PermissionsService, but findOne
    // reads scope from the ctx; OWN is supplied for both.
  });
  assert.equal(ok.asset.id, assetId, 'the account manager can download it');

  // User B, OWN scope, is NOT the account manager → must be refused.
  await assert.rejects(
    () => service.openForDownload(assetId, userB),
    /permission|access/i,
    'a different OWN-scope user must be denied user A’s client asset',
  );
});

test('A-2: an ALL-scope viewer can download any client asset', async () => {
  const manager = await seedUser('mgr2');
  const assetId = await seedClientOwnedAsset(manager.id);

  const allViewer = await seedUser('alladmin');
  // Override the permission resolution to grant ALL for this assertion.
  const allPermissions = {
    resolveForUser: async () => new Map([['clients:view', 'ALL']]),
  } as unknown as PermissionsService;
  const allService = new FilesService(
    prisma,
    config,
    storage,
    allPermissions,
    clients,
    quotes,
    rfqs,
  );

  const ok = await allService.openForDownload(assetId, allViewer);
  assert.equal(ok.asset.id, assetId, 'ALL scope downloads any client asset');
});

test('A-2: a non-sensitive asset is downloadable by any authenticated user', async () => {
  const user = await seedUser('anyone');
  const file: UploadedFileLike = {
    originalname: 'logo.png',
    mimetype: 'image/png',
    size: 4,
    buffer: Buffer.from('PNG!'),
  };
  const asset = await service.upload(file, {}); // no ownerResource
  trash.assetIds.push(asset.id);

  const ok = await service.openForDownload(asset.id, user);
  assert.equal(ok.asset.id, asset.id, 'non-sensitive asset served to any user');
});
