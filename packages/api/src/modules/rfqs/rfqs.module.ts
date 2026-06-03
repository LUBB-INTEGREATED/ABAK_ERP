import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RfqAssignmentsController } from './rfq-assignments.controller';
import { RfqAssignmentsService } from './rfq-assignments.service';
import { RfqsController } from './rfqs.controller';
import { RfqsService } from './rfqs.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [RfqsController, RfqAssignmentsController],
  providers: [RfqsService, RfqAssignmentsService],
  exports: [RfqsService, RfqAssignmentsService],
})
export class RfqsModule {}
