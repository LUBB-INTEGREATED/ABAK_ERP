import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT ?? process.env.PORT ?? '3001', 10),
  environment: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  globalPrefix: process.env.APP_GLOBAL_PREFIX ?? 'api/v1',
  // UP-1 upload pipeline: disk-volume root for the default storage provider.
  uploadDir: process.env.UPLOAD_DIR ?? 'storage/uploads',
}));
