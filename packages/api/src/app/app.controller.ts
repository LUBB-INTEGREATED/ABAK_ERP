import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators/public.decorator';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Service health check' })
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
}
