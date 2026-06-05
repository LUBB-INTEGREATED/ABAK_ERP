/**
 * A-4 / A-22 (DATA-LOSS GUARD).
 *
 * The demo seed (prisma/seed.ts) opens with ~40 unconditional deleteMany()
 * calls that wipe EVERY business table. Running it — or `prisma migrate reset`
 * when the seed hook still pointed at it — against a real DATABASE_URL destroys
 * all client, lead, quote, project and finance data.
 *
 * This guard makes the destructive path refuse to run unless BOTH:
 *   - NODE_ENV is NOT 'production', AND
 *   - ALLOW_DESTRUCTIVE_SEED is explicitly '1'.
 *
 * It is intentionally a tiny pure function (env in → throw or return) so it can
 * be unit-tested without importing the self-executing seed entrypoint.
 */
export function assertDestructiveSeedAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the destructive demo seed: NODE_ENV=production. ' +
        'This seed wipes every table. Use `prisma db seed` (the idempotent ' +
        'RBAC seed) for production bootstrap.',
    );
  }
  if (env.ALLOW_DESTRUCTIVE_SEED !== '1') {
    throw new Error(
      'Refusing to run the destructive demo seed without an explicit opt-in. ' +
        'This seed wipes every table. Set ALLOW_DESTRUCTIVE_SEED=1 (and keep ' +
        'NODE_ENV out of production) to run it, e.g. `npm run prisma:seed:demo`.',
    );
  }
}
