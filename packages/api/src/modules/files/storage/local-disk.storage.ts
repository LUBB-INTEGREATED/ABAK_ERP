import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SAFE_STORAGE_KEY, type StorageProvider } from './storage.provider';

/**
 * Disk-volume storage (UP-1 default). Writes each object as a single file named
 * by its opaque key under `app.uploadDir` (env `UPLOAD_DIR`, default
 * `storage/uploads`). Swap the {@link STORAGE_PROVIDER} binding for S3 later.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>('app.uploadDir') ?? 'storage/uploads',
    );
  }

  /** Resolve `key` to an absolute path, refusing anything outside the root. */
  private pathFor(key: string): string {
    // The regex already forbids `/`, `.` and absolute paths; the startsWith
    // assertion is belt-and-suspenders against the root being escaped.
    if (!SAFE_STORAGE_KEY.test(key) || isAbsolute(key) || key.includes(sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    const full = resolve(join(this.root, key));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return full;
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.pathFor(key), buffer);
    this.logger.debug(`stored ${buffer.byteLength}B as ${key}`);
  }

  async createReadStream(key: string): Promise<Readable> {
    return createReadStream(this.pathFor(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
