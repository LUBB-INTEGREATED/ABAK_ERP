import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT ?? process.env.PORT ?? '3001', 10),
  environment: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  globalPrefix: process.env.APP_GLOBAL_PREFIX ?? 'api/v1',
}));
