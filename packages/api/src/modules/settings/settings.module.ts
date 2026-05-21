import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingPolicyController } from './pricing-policy.controller';
import { PricingPolicyService } from './pricing-policy.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, PricingPolicyController],
  providers: [SettingsService, PricingPolicyService],
  exports: [SettingsService, PricingPolicyService],
})
export class SettingsModule {}
