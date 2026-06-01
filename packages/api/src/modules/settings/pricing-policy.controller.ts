import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import {
  PricingPolicyService,
  type UpdatePricingPolicyDto,
} from './pricing-policy.service';

@ApiTags('admin-pricing-policy')
@Controller('admin/pricing-policy')
@RequirePermission('settings:view')
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
  @RequirePermission('settings:manage_pricing_policy')
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
