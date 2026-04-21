import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth('JWT-auth')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List active services with their category' })
  findAll() {
    return this.services.findAll();
  }
}
