import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { swaggerConfig } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3001;
  const globalPrefix = config.get<string>('app.globalPrefix') ?? 'api/v1';
  const frontendUrl =
    config.get<string>('app.frontendUrl') ?? 'http://localhost:3000';

  app.setGlobalPrefix(globalPrefix);

  app.enableCors({
    origin: [
      frontendUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3003',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // A-19: Nest reverses the global-filter list and picks the first match, so
  // the LAST-registered filter is evaluated first. Registering the specific
  // HttpExceptionFilter last makes it win for HttpExceptions, while the
  // catch-all AllExceptionsFilter only fires for non-HttpExceptions (Prisma
  // errors, unexpected throws) — same envelope, no leaked stack to the client.
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);

  logger.log(`🚀 API running at http://localhost:${port}/${globalPrefix}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
