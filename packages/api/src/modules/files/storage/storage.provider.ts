import type { Readable } from 'node:stream';

/**
 * Pluggable storage seam for the upload pipeline (UP-1).
 *
 * The default binding is {@link LocalDiskStorageProvider} (a disk volume); an
 * S3/GCS provider can be dropped in behind the same interface without touching
 * callers. Keys are server-generated opaque ids (the owning `FileAsset.id`), so
 * providers MUST treat the key as untrusted and refuse path traversal.
 */
export interface StorageProvider {
  /** Persist the bytes under `key`. Overwrites if the key already exists. */
  save(key: string, buffer: Buffer): Promise<void>;
  /** Open a read stream for `key`. Rejects if the key is unknown. */
  createReadStream(key: string): Promise<Readable>;
  /** Whether bytes are stored for `key`. */
  exists(key: string): Promise<boolean>;
  /** Remove the bytes for `key` (no-op if absent). */
  delete(key: string): Promise<void>;
}

/** DI token for the active {@link StorageProvider} binding. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

/**
 * Opaque storage keys only: alphanumerics, dash, underscore. Blocks `/`, `..`,
 * and absolute paths so a crafted `:id` can never escape the storage root.
 */
export const SAFE_STORAGE_KEY = /^[A-Za-z0-9_-]{1,128}$/;
