import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClassificationService } from './classification.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClassificationService],
  exports: [ClientsService, ClassificationService],
})
export class ClientsModule {}
