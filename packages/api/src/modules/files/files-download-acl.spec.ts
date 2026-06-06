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
import { AuditService } from '../audit/audit.service';
import { FilesService, type UploadedFileLike } from './files.service';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';

// A-2 (IDOR) + SR2-3 (default-deny) regression. Runs against the live dev
// Postgres (DATABASE_URL via --env-file). GET /files/:id/download must:
//   - serve a client/quote/rfq asset ONLY to a caller with scope on the owning
//     record (object-level check, same as that resource's detail route);
//   - DENY a null/unknown-owner asset and a payment/PO/gov asset to anyone who
//     is not ALL-scoped/admin — the old "authentication is sufficient"
//     fall-through is gone.

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
const audit = { log: async () => undefined } as unknown as AuditService;
const clients = new ClientsService(prisma, notifications, audit);

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

// An ALL-scope (admin-ish) service: holds clients:view + finance:view + gov:view
// all at ALL. Used to prove that an ALL caller can pull every owner type.
const allPermissions = {
  resolveForUser: async () =>
    new Map([
      ['clients:view', 'ALL'],
      ['finance:view', 'ALL'],
      ['gov:view', 'ALL'],
    ]),
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

const pdf = (name: string): UploadedFileLike => ({
  originalname: name,
  mimetype: 'application/pdf',
  size: 4,
  buffer: Buffer.from('%PDF'),
});

test('A-2: user B (OWN scope, not the manager) cannot download user A’s client asset', async () => {
  const userA = await seedUser('owner');
  const userB = await seedUser('attacker');
  const assetId = await seedClientOwnedAsset(userA.id);

  // The owning account manager (OWN scope) downloads their own asset.
  const ok = await service.openForDownload(assetId, userA);
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
  const ok = await allService.openForDownload(assetId, allViewer);
  assert.equal(ok.asset.id, assetId, 'ALL scope downloads any client asset');
});

test('SR2-3: a null-owner asset is DENIED to a non-ALL user, served to an admin', async () => {
  const user = await seedUser('null-owner-attacker');
  const asset = await service.upload(pdf('mystery.pdf'), {}); // no ownerResource
  trash.assetIds.push(asset.id);

  // Default-deny: a null-owner asset is no longer "authentication is sufficient".
  await assert.rejects(
    () => service.openForDownload(asset.id, user),
    /permission|access/i,
    'a non-ALL user is refused a null-owner asset',
  );

  // An admin (ANY ALL-scope grant) may pull an unclassified asset.
  const admin = await seedUser('null-owner-admin');
  const ok = await allService.openForDownload(asset.id, admin);
  assert.equal(ok.asset.id, asset.id, 'an ALL-scope admin can pull it');
});

test('SR2-3: a payment/gov asset is DENIED to a non-ALL user, served to ALL', async () => {
  const user = await seedUser('finance-attacker');
  const payment = await service.upload(pdf('receipt.pdf'), {
    ownerResource: 'payment',
    ownerResourceId: 'pay-123',
  });
  trash.assetIds.push(payment.id);
  const gov = await service.upload(pdf('licence.pdf'), {
    ownerResource: 'gov',
    ownerResourceId: 'gov-123',
  });
  trash.assetIds.push(gov.id);

  // The non-ALL user only holds clients:view OWN → no finance/gov ALL → denied.
  await assert.rejects(
    () => service.openForDownload(payment.id, user),
    /permission|access/i,
    'a non-finance user is refused a payment asset',
  );
  await assert.rejects(
    () => service.openForDownload(gov.id, user),
    /permission|access/i,
    'a non-gov user is refused a gov asset',
  );

  // ALL on finance:view / gov:view → served.
  const admin = await seedUser('finance-admin');
  const okPay = await allService.openForDownload(payment.id, admin);
  assert.equal(
    okPay.asset.id,
    payment.id,
    'finance:view ALL pulls the payment',
  );
  const okGov = await allService.openForDownload(gov.id, admin);
  assert.equal(okGov.asset.id, gov.id, 'gov:view ALL pulls the gov asset');
});

test('SR2-1: listForOwner refuses cross-scope enumeration', async () => {
  const userA = await seedUser('list-owner');
  const userB = await seedUser('list-attacker');
  const client = await prisma.client.create({
    data: {
      clientNumber: `${TAG}-L-${trash.clientIds.length}`,
      contactName: `${TAG}-list`,
      phone: `+9665${(Date.now() + 1).toString().slice(-8)}`,
      accountManagerId: userA.id,
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);
  const asset = await service.upload(pdf('doc.pdf'), {
    ownerResource: 'client',
    ownerResourceId: client.id,
  });
  trash.assetIds.push(asset.id);

  // Owner (account manager, OWN scope) can list their client's files.
  const ownList = await service.listForOwner('client', client.id, userA);
  assert.ok(
    ownList.some((a) => a.id === asset.id),
    'the account manager can list the client’s files',
  );

  // User B (OWN scope, not the manager) cannot enumerate user A’s client files.
  await assert.rejects(
    () => service.listForOwner('client', client.id, userB),
    /permission|access/i,
    'a different OWN-scope user cannot enumerate the client’s files',
  );
});

test('SR2-3: upload rejects an unknown ownerResource', async () => {
  await assert.rejects(
    () => service.upload(pdf('evil.pdf'), { ownerResource: 'totally-made-up' }),
    /unknown ownerresource/i,
    'an unknown ownerResource is refused before any bytes are stored',
  );
});
