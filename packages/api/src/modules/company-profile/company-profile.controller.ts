import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyProfileService } from './company-profile.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

/**
 * Company Profile settings (singleton). The who-we-are / contact / bank box
 * printed on every price-offer PDF.
 *
 * GET is auth-only (no @RequirePermission → the JwtAuthGuard still requires a
 * valid session) so quote builders can render the profile. PUT/PATCH/history
 * require `company_profile.manage` (SUPER_ADMIN holds it) because they touch
 * money-security-sensitive bank details, which are also per-field audited.
 *
 * Mirrors PricingPolicyController (singleton GET + PUT).
 */
@ApiTags('admin-company-profile')
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly service: CompanyProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the active CompanyProfile (singleton). Auth-gated read.',
  })
  get() {
    return this.service.get();
  }

  @Put()
  @RequirePermission('company_profile.manage')
  @ApiOperation({
    summary:
      'Replace fields on the singleton CompanyProfile. Validates IBAN + bank name; audits bank changes. Requires company_profile.manage.',
  })
  put(
    @Body() dto: UpdateCompanyProfileDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.update(dto, actorId);
  }

  @Patch()
  @RequirePermission('company_profile.manage')
  @ApiOperation({
    summary:
      'Partial-update the singleton CompanyProfile. Same validation + audit as PUT. Requires company_profile.manage.',
  })
  patch(
    @Body() dto: UpdateCompanyProfileDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.update(dto, actorId);
  }

  @Get('history')
  @RequirePermission('company_profile.manage')
  @ApiOperation({
    summary:
      'Append-only audit of bank-detail changes (newest first). Requires company_profile.manage.',
  })
  history() {
    return this.service.history();
  }
}
