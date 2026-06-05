import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm } from 'node:fs/promises';
import type { ConfigService } from '@nestjs/config';
import type { PermissionsService } from '../auth/permissions.service';
import type { ClientsService } from '../clients/clients.service';
import type { QuotesService } from '../quotes/quotes.service';
import type { RfqsService } from '../rfqs/rfqs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService, type UploadedFileLike } from './files.service';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';

// SR2-2 (DEFAULT-DENY /raw). The @Public raw route must serve ONLY assets
// explicitly flagged public (logo / public-asset). Everything else — a
// client/quote/rfq doc, a payment/PO/gov doc, AND a null/unknown-owner upload
// (which is what an RFQ doc-request web attach produces) — is refused on /raw.
// This is the confidential-document-leak fix: an unguessable id is no longer a
// permanent public bearer for ANY private asset.

const ROOT = `/tmp/sr2-raw-store-${process.pid}`;
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
// The public raw route (openStored) never touches the ACL deps; stub them.
const permissions = {} as unknown as PermissionsService;
const clients = {} as unknown as ClientsService;
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

const assetIds: string[] = [];

after(async () => {
  for (const id of assetIds) {
    await storage.delete(id).catch(() => undefined);
    await prisma.fileAsset.deleteMany({ where: { id } });
  }
  await rm(ROOT, { recursive: true, force: true });
  await prisma.$disconnect();
});

const file = (name: string): UploadedFileLike => ({
  originalname: name,
  mimetype: 'application/pdf',
  size: 4,
  buffer: Buffer.from('%PDF'),
});

test('SR2-2: a client-owned asset is refused on the public /raw route', async () => {
  const asset = await service.upload(file('contract.pdf'), {
    ownerResource: 'client',
  });
  assetIds.push(asset.id);

  await assert.rejects(
    () => service.openStored(asset.id),
    /not.?found|NotFound/i,
    'public openStored refuses the (private) client asset',
  );
});

test('SR2-2: a null/unknown-owner upload (RFQ web attach) is refused on /raw', async () => {
  // No ownerResource — exactly what the RFQ doc-request web attach produces.
  const asset = await service.upload(file('rfq-attachment.pdf'), {});
  assetIds.push(asset.id);

  await assert.rejects(
    () => service.openStored(asset.id),
    /not.?found|NotFound/i,
    'a null-owner upload is NOT a public asset and is refused on /raw',
  );
});

test('SR2-2: a payment-owned asset is refused on /raw', async () => {
  const asset = await service.upload(file('receipt.pdf'), {
    ownerResource: 'payment',
  });
  assetIds.push(asset.id);

  await assert.rejects(
    () => service.openStored(asset.id),
    /not.?found|NotFound/i,
    'a payment asset is private and refused on /raw',
  );
});

test('SR2-2: an explicitly public (logo) asset IS served on /raw', async () => {
  const asset = await service.upload(
    {
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: 4,
      buffer: Buffer.from('PNG!'),
    },
    { ownerResource: 'logo' },
  );
  assetIds.push(asset.id);
  assert.equal(asset.isPublic, true, 'a logo upload is flagged public');

  const ok = await service.openStored(asset.id);
  assert.equal(ok.asset.id, asset.id, 'public openStored serves the logo');
});
