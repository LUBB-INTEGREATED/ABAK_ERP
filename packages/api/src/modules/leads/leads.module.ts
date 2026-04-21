import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssignmentService } from './assignment.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeadsController],
  providers: [LeadsService, AssignmentService],
  exports: [LeadsService, AssignmentService],
})
export class LeadsModule {}
