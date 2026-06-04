import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm } from 'node:fs/promises';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService, type UploadedFileLike } from './files.service';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';

// RV-20: the public raw route must refuse confidential (client/quote/rfq)
// assets; an authenticated path (allowSensitive) may still serve them.

const ROOT = `/tmp/rv20-store-${process.pid}`;
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
const service = new FilesService(prisma, config, storage);

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

test('RV-20: a client-owned asset is refused on the public route, served with allowSensitive', async () => {
  const asset = await service.upload(file('contract.pdf'), {
    ownerResource: 'client',
  });
  assetIds.push(asset.id);

  await assert.rejects(
    () => service.openStored(asset.id),
    /private|authentication/i,
    'public openStored refuses the client asset',
  );

  const ok = await service.openStored(asset.id, { allowSensitive: true });
  assert.equal(ok.asset.id, asset.id, 'authed openStored serves it');
});

test('RV-20: a non-sensitive asset is still served on the public route', async () => {
  const asset = await service.upload(file('logo.pdf'), {});
  assetIds.push(asset.id);
  const ok = await service.openStored(asset.id);
  assert.equal(
    ok.asset.id,
    asset.id,
    'public openStored serves a non-sensitive asset',
  );
});
