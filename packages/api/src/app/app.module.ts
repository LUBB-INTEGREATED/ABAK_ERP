import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from '../config/app.config';
import authConfig from '../config/auth.config';
import databaseConfig from '../config/database.config';
import { validateEnv } from '../config/env.validation';
import { LocaleMiddleware } from '../common/middleware/locale.middleware';
import { AdminModule } from '../modules/admin/admin.module';
import { AuditModule } from '../modules/audit/audit.module';
import { AuthModule } from '../modules/auth/auth.module';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../modules/auth/guards/permission.guard';
import { ClientsModule } from '../modules/clients/clients.module';
import { CompanyProfileModule } from '../modules/company-profile/company-profile.module';
import { EscalationModule } from '../modules/escalation/escalation.module';
import { FilesModule } from '../modules/files/files.module';
import { FinanceModule } from '../modules/finance/finance.module';
import { GovTransactionsModule } from '../modules/gov-transactions/gov-transactions.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { HolidaysModule } from '../modules/holidays/holidays.module';
import { I18nModule } from '../modules/i18n/i18n.module';
import { LeadsModule } from '../modules/leads/leads.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { PdfModule } from '../modules/pdf/pdf.module';
import { PipelineModule } from '../modules/pipeline/pipeline.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { QuotesModule } from '../modules/quotes/quotes.module';
import { RfqsModule } from '../modules/rfqs/rfqs.module';
import { ServicesModule } from '../modules/services/services.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { UsersModule } from '../modules/users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig],
      envFilePath: ['.env.local', '.env'],
      // A-3/A-6: fail fast at boot on a missing/weak/fallback JWT_SECRET (and a
      // missing DATABASE_URL). Hard in production, warns in dev.
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    I18nModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    AdminModule,
    LeadsModule,
    ClientsModule,
    PipelineModule,
    ProjectsModule,
    QuotesModule,
    PdfModule,
    RfqsModule,
    ServicesModule,
    HolidaysModule,
    SettingsModule,
    CompanyProfileModule,
    EscalationModule,
    FinanceModule,
    FilesModule,
    GovTransactionsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LocaleMiddleware).forRoutes('*');
  }
}
