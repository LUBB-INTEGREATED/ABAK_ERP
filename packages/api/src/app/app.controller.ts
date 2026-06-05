import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Service liveness check (process up, no DB)' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', example: '2026-04-20T10:30:00.000Z' },
            uptime: { type: 'number', example: 12345 },
            environment: { type: 'string', example: 'development' },
          },
        },
        timestamp: { type: 'string', example: '2026-04-20T10:30:00.000Z' },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({
    summary: 'Service readiness check (verifies the DB with SELECT 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready — the database is reachable',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            database: { type: 'string', example: 'up' },
            timestamp: { type: 'string', example: '2026-04-20T10:30:00.000Z' },
          },
        },
        timestamp: { type: 'string', example: '2026-04-20T10:30:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready — the database is unreachable',
  })
  async getReadiness() {
    try {
      return await this.appService.getReadiness();
    } catch (error) {
      // Log the cause server-side; surface only a 503 to the probe so a
      // dead-DB instance is routed away from (A-21).
      this.logger.error(
        'Readiness check failed: database unreachable',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
  }
}
