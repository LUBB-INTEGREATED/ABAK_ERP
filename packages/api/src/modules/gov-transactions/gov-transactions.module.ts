import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GovTransactionsController } from './gov-transactions.controller';
import { GovTransactionsService } from './gov-transactions.service';

@Module({
  imports: [PrismaModule],
  controllers: [GovTransactionsController],
  providers: [GovTransactionsService],
  exports: [GovTransactionsService],
})
export class GovTransactionsModule {}
