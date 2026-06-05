import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertDestructiveSeedAllowed } from './seed-guard';

// A-4 / A-22 regression. The destructive demo seed (prisma/seed.ts) wipes every
// business table; this guard must refuse to run it in production and require an
// explicit ALLOW_DESTRUCTIVE_SEED=1 opt-in elsewhere. Pure-function test — no DB.
//
// Run: node -r @swc-node/register prisma/seed-guard.spec.ts

test('A-4: throws in production even with the opt-in flag set', () => {
  assert.throws(
    () =>
      assertDestructiveSeedAllowed({
        NODE_ENV: 'production',
        ALLOW_DESTRUCTIVE_SEED: '1',
      }),
    /NODE_ENV=production/,
  );
});

test('A-22: throws when the opt-in flag is absent (non-production)', () => {
  assert.throws(
    () => assertDestructiveSeedAllowed({ NODE_ENV: 'development' }),
    /without an explicit opt-in/,
  );
});

test('A-22: throws when the opt-in flag is set to a wrong value', () => {
  assert.throws(
    () =>
      assertDestructiveSeedAllowed({
        NODE_ENV: 'development',
        ALLOW_DESTRUCTIVE_SEED: 'true',
      }),
    /without an explicit opt-in/,
  );
});

test('allows only when not production AND ALLOW_DESTRUCTIVE_SEED=1', () => {
  assert.doesNotThrow(() =>
    assertDestructiveSeedAllowed({
      NODE_ENV: 'development',
      ALLOW_DESTRUCTIVE_SEED: '1',
    }),
  );
  // undefined NODE_ENV (typical local dev) with the flag is also allowed.
  assert.doesNotThrow(() =>
    assertDestructiveSeedAllowed({ ALLOW_DESTRUCTIVE_SEED: '1' }),
  );
});
