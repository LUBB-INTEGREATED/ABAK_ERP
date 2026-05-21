import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  PricingPolicyService,
  type UpdatePricingPolicyDto,
} from './pricing-policy.service';

@ApiTags('admin-pricing-policy')
@Controller('admin/pricing-policy')
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER)
export class PricingPolicyController {
  constructor(private readonly service: PricingPolicyService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get the active PricingPolicy (singleton). Drives discount + quote approval routing per the 2026-05-21 process correction.',
  })
  get() {
    return this.service.getOrCreate();
  }

  @Put()
  @ApiOperation({
    summary:
      'Replace the PricingPolicy. Only Sales Manager / Admin / CEO roles.',
  })
  update(
    @Body() dto: UpdatePricingPolicyDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.update(dto, actorId);
  }
}
