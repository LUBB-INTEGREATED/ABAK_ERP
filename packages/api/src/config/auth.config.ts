import { registerAs } from '@nestjs/config';

// A-3/A-6: NO hardcoded fallback. The committed dev-secret fallback let a
// production deploy with a missing JWT_SECRET silently sign AND verify tokens
// with a publicly-known key (total auth bypass). JWT_SECRET is validated at
// boot by validateEnv (config/env.validation.ts); this throws as a last line
// of defense if it is somehow still unset when the config is built.
export default registerAs('auth', () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to boot with no JWT secret (no ' +
        'fallback). Set a strong random JWT_SECRET in the environment.',
    );
  }
  return {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    refreshExpiresInDays: parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7',
      10,
    ),
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
  };
});
