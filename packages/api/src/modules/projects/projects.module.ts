import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  LicencesController,
  PhaseLicenceOverrideController,
} from './licences.controller';
import { LicencesService } from './licences.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [
    ProjectsController,
    LicencesController,
    PhaseLicenceOverrideController,
  ],
  providers: [ProjectsService, LicencesService],
  exports: [ProjectsService, LicencesService],
})
export class ProjectsModule {}
