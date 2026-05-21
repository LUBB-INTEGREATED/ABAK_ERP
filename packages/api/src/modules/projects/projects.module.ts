import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LicencesController } from './licences.controller';
import { LicencesService } from './licences.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, LicencesController],
  providers: [ProjectsService, LicencesService],
  exports: [ProjectsService, LicencesService],
})
export class ProjectsModule {}
