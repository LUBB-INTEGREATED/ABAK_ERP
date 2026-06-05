/**
 * A-3 / A-6 — boot-time environment validation.
 *
 * Wired into `ConfigModule.forRoot({ validate })`, this runs at module init
 * (before the app accepts traffic) and fails fast on a misconfigured
 * deployment. The headline risk it closes: a production deploy with a missing,
 * blank, weak, or fallback JWT_SECRET would otherwise silently sign and VERIFY
 * tokens with a publicly-known key — a total auth bypass (anyone can forge a
 * SUPER_ADMIN token).
 *
 * In production the rules are HARD (throw). In dev they degrade to warnings so
 * a local checkout keeps working without ceremony.
 */

/** The committed dev fallback that must never reach production. */
export const INSECURE_JWT_FALLBACK = 'dev-secret-change-in-production-please';

/** Minimum acceptable JWT secret length (bytes/characters). */
export const MIN_JWT_SECRET_LENGTH = 32;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isProduction = nodeEnv === 'production';

  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = config.JWT_SECRET;
  const databaseUrl = config.DATABASE_URL;

  // --- DATABASE_URL (required everywhere) ---
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    errors.push('DATABASE_URL is required but missing or empty.');
  }

  // --- JWT_SECRET ---
  const secretIssues: string[] = [];
  if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    secretIssues.push('JWT_SECRET is required but missing or empty.');
  } else {
    if (jwtSecret === INSECURE_JWT_FALLBACK) {
      secretIssues.push(
        'JWT_SECRET is set to the publicly-known dev fallback ' +
          `("${INSECURE_JWT_FALLBACK}") — anyone can forge tokens. Set a ` +
          'strong random value.',
      );
    }
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      secretIssues.push(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
          `(got ${jwtSecret.length}).`,
      );
    }
  }

  // In production any JWT_SECRET issue is fatal; in dev it is a loud warning so
  // local development keeps working with the fallback.
  if (isProduction) {
    errors.push(...secretIssues);
  } else {
    warnings.push(...secretIssues);
  }

  if (warnings.length) {
     
    console.warn(
      `[env] non-production warnings:\n  - ${warnings.join('\n  - ')}`,
    );
  }

  if (errors.length) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return config;
}
