import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production-please',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '7', 10),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
}));
