import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EscalationController } from './escalation.controller';
import { EscalationService } from './escalation.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EscalationController],
  providers: [EscalationService],
  exports: [EscalationService],
})
export class EscalationModule {}
