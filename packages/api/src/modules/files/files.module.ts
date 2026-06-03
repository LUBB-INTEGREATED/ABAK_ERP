import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalDiskStorageProvider } from './storage/local-disk.storage';
import { STORAGE_PROVIDER } from './storage/storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    // UP-1 storage seam: disk volume by default; swap for S3 behind the token.
    { provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider },
  ],
  exports: [FilesService],
})
export class FilesModule {}
