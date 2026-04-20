import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('ABAK ERP API')
  .setDescription('Complete API documentation for the ABAK ERP system')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addTag('health', 'Service health and readiness probes')
  .addTag('auth', 'Authentication endpoints')
  .addTag('leads', 'Lead capture and management (Module 1)')
  .addTag('clients', 'Client relationship management (Module 2)')
  .addTag('pipeline', 'Sales pipeline and team management (Module 3)')
  .addTag('quotes', 'Quotation and pricing (Module 4)')
  .addTag('marketing', 'Digital marketing hub (Module 5)')
  .addTag('users', 'User management')
  .build();
