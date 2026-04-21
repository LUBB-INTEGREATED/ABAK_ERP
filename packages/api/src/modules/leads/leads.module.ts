import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssignmentService } from './assignment.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { SlaService } from './sla.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeadsController],
  providers: [LeadsService, AssignmentService, SlaService],
  exports: [LeadsService, AssignmentService, SlaService],
})
export class LeadsModule {}
