import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { MaxFileSizeValidator } from '@nestjs/common';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from './files.controller';

// RV-4: the upload allowlist + size cap (defense-in-depth behind RV-3's multer
// stream limit). ALLOWED_MIME is the contract the controller's FileTypeValidator
// matches against, so testing it directly pins the accepted/rejected set.

test('RV-4: ALLOWED_MIME accepts raster images + PDF only', () => {
  for (const ok of [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/pdf',
  ]) {
    assert.equal(ALLOWED_MIME.test(ok), true, `accepts ${ok}`);
  }
});

test('RV-4: ALLOWED_MIME rejects SVG + spoofed/active-content mimetypes', () => {
  for (const bad of [
    'image/svg+xml',
    'image/svg',
    'text/html',
    'application/javascript',
    'application/octet-stream',
    'text/xml',
  ]) {
    assert.equal(ALLOWED_MIME.test(bad), false, `rejects ${bad}`);
  }
});

test('RV-4: MaxFileSizeValidator rejects at/over the cap (strict <), accepts under', () => {
  const maxSize = new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_BYTES });
  const file = (size: number) =>
    ({ mimetype: 'image/png', size, originalname: 'x' }) as never;
  assert.equal(maxSize.isValid(file(MAX_UPLOAD_BYTES - 1)), true, 'under cap');
  assert.equal(
    maxSize.isValid(file(MAX_UPLOAD_BYTES)),
    false,
    'at cap (strict <)',
  );
  assert.equal(maxSize.isValid(file(MAX_UPLOAD_BYTES + 1)), false, 'over cap');
});
