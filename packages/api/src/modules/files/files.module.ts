import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { QuotesModule } from '../quotes/quotes.module';
import { RfqsModule } from '../rfqs/rfqs.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';
import { STORAGE_PROVIDER } from './storage/storage.provider';

@Module({
  // A-2: the authenticated download route re-runs the owning-module
  // object-level scope check, so Files depends on Auth (PermissionsService) and
  // the owning resource services (Clients/Quotes/Rfqs) for the per-asset ACL.
  imports: [PrismaModule, AuthModule, ClientsModule, QuotesModule, RfqsModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    // UP-1 storage seam: disk volume by default; swap for S3 behind the token.
    { provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider },
  ],
  exports: [FilesService],
})
export class FilesModule {}
