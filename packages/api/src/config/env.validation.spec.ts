import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  INSECURE_JWT_FALLBACK,
  MIN_JWT_SECRET_LENGTH,
  validateEnv,
} from './env.validation';

// A-3 / A-6 regression. Boot-time env validation must reject a missing, blank,
// fallback, or short JWT_SECRET in production (a forged-token / auth-bypass
// risk) and require DATABASE_URL. Dev degrades to warnings so a local checkout
// keeps working. Pure-function tests — no app boot.

const strongSecret = 'x'.repeat(MIN_JWT_SECRET_LENGTH);
const db = 'postgresql://u:p@localhost:5432/db';

test('A-3: production with no JWT_SECRET fails boot', () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'production', DATABASE_URL: db }),
    /JWT_SECRET is required/,
  );
});

test('A-6: production with the committed dev fallback fails boot', () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: db,
        JWT_SECRET: INSECURE_JWT_FALLBACK,
      }),
    /publicly-known dev fallback/,
  );
});

test('production with a too-short JWT_SECRET fails boot', () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: db,
        JWT_SECRET: 'short',
      }),
    /at least/,
  );
});

test('production with no DATABASE_URL fails boot', () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'production', JWT_SECRET: strongSecret }),
    /DATABASE_URL is required/,
  );
});

test('production with a strong secret and DATABASE_URL passes', () => {
  assert.doesNotThrow(() =>
    validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: db,
      JWT_SECRET: strongSecret,
    }),
  );
});

test('dev still boots with the fallback (warns, does not throw)', () => {
  const orig = console.warn;
  let warned = '';
  console.warn = (...args: unknown[]) => {
    warned += args.join(' ');
  };
  try {
    assert.doesNotThrow(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: db,
        JWT_SECRET: INSECURE_JWT_FALLBACK,
      }),
    );
  } finally {
    console.warn = orig;
  }
  assert.match(warned, /dev fallback/);
});

test('dev with no DATABASE_URL still fails (DB is required everywhere)', () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'development', JWT_SECRET: strongSecret }),
    /DATABASE_URL is required/,
  );
});
