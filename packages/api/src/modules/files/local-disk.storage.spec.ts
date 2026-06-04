import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rm } from 'node:fs/promises';
import type { ConfigService } from '@nestjs/config';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';

// RV-4: storage path-traversal + round-trip unit tests (no DB / no HTTP).

const ROOT = `/tmp/rv4-store-${process.pid}`;
const config = { get: () => ROOT } as unknown as ConfigService;
const store = new LocalDiskStorageProvider(config);

after(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

const UNSAFE = [
  '../escape',
  'a/b',
  '..',
  'with/slash',
  '',
  '/abs',
  'a'.repeat(129),
];

test('RV-4: save/read/delete REJECT unsafe keys (traversal/absolute/sep/empty/too-long)', async () => {
  for (const bad of UNSAFE) {
    await assert.rejects(
      () => store.save(bad, Buffer.from('x')),
      /Unsafe storage key|escapes root/,
      `save rejects ${JSON.stringify(bad)}`,
    );
    await assert.rejects(
      () => store.createReadStream(bad),
      /Unsafe storage key|escapes root/,
      `read rejects ${JSON.stringify(bad)}`,
    );
    assert.equal(
      await store.exists(bad),
      false,
      `exists is false for ${JSON.stringify(bad)}`,
    );
  }
});

test('RV-4: round-trips bytes for a safe key and deletes them', async () => {
  const key = '11111111-2222-3333-4444-555555555555';
  const bytes = Buffer.from('PNGDATA-أهلاً-\x00\x01\x02', 'utf8');
  await store.save(key, bytes);
  assert.equal(await store.exists(key), true, 'exists after save');
  const stream = await store.createReadStream(key);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  assert.deepEqual(Buffer.concat(chunks), bytes, 'round-trip bytes match');
  await store.delete(key);
  assert.equal(await store.exists(key), false, 'gone after delete');
});
