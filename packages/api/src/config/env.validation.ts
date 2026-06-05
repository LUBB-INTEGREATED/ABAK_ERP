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
 * SR2-3: the publicly-known committed fallback (and a missing secret) is fatal
 * in EVERY environment — a deploy that forgets NODE_ENV=production must NOT boot
 * with the shipped key. Only the soft length rule relaxes in `development`, and
 * only to a warning. A real (non-fallback) secret is required everywhere.
 */

/** The committed dev fallback that must never reach production. */
export const INSECURE_JWT_FALLBACK = 'dev-secret-change-in-production-please';

/** Minimum acceptable JWT secret length (bytes/characters). */
export const MIN_JWT_SECRET_LENGTH = 32;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  // SR2-3: only an explicit `development` env relaxes the soft (length) rule;
  // any other value (production, staging, test, or a typo) is treated as strict
  // so a deploy that forgets NODE_ENV=production is NOT silently lenient.
  const isDevelopment = nodeEnv === 'development';

  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = config.JWT_SECRET;
  const databaseUrl = config.DATABASE_URL;

  // --- DATABASE_URL (required everywhere) ---
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    errors.push('DATABASE_URL is required but missing or empty.');
  }

  // --- JWT_SECRET ---
  // SR2-3: the publicly-known committed fallback must NEVER sign/verify tokens,
  // in ANY environment. A deploy that forgets NODE_ENV=production would
  // otherwise boot with the fallback and let anyone forge a SUPER_ADMIN token.
  // So the fallback (and a missing secret) is ALWAYS fatal — dev included.
  // Developers keep working by setting a real secret (any value that isn't the
  // shipped fallback); .env.example now ships a CHANGE_ME placeholder, not the
  // fallback, so a fresh checkout fails fast until the developer sets one.
  const fatalSecretIssues: string[] = [];
  // Non-fallback weaknesses (e.g. too short) stay strict only outside dev so a
  // local checkout isn't forced to a 32-char secret.
  const softSecretIssues: string[] = [];
  if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    fatalSecretIssues.push('JWT_SECRET is required but missing or empty.');
  } else {
    if (jwtSecret === INSECURE_JWT_FALLBACK) {
      fatalSecretIssues.push(
        'JWT_SECRET is set to the publicly-known dev fallback ' +
          `("${INSECURE_JWT_FALLBACK}") — anyone can forge tokens. Set a ` +
          'strong random value (this fails boot in EVERY environment).',
      );
    }
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      softSecretIssues.push(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
          `(got ${jwtSecret.length}).`,
      );
    }
  }

  // The fallback/missing-secret issues are ALWAYS fatal (any NODE_ENV). The
  // length-only weakness is fatal outside dev and a warning in dev.
  errors.push(...fatalSecretIssues);
  if (!isDevelopment) {
    errors.push(...softSecretIssues);
  } else {
    warnings.push(...softSecretIssues);
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
