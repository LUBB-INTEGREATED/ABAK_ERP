import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { FilesModule } from '../files/files.module';
import { LocalDiskStorageProvider } from '../files/storage/local-disk.storage';
import { STORAGE_PROVIDER } from '../files/storage/storage.provider';
import { GovTransactionsModule } from '../gov-transactions/gov-transactions.module';
import { LeadsModule } from '../leads/leads.module';
import { ProjectsModule } from '../projects/projects.module';
import { QuotesModule } from '../quotes/quotes.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

/**
 * WS-D / DOC-A — Document Control (Wave-0).
 *
 * Imports the owning-resource modules so the service can re-run each entity's
 * object-level scope check, plus FilesModule for the upload pipeline. It binds
 * its OWN STORAGE_PROVIDER (the same disk volume FilesModule uses) so it can
 * stream downloads directly after running the entity-scope ACL.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FilesModule,
    ProjectsModule,
    GovTransactionsModule,
    QuotesModule,
    ClientsModule,
    LeadsModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    { provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
