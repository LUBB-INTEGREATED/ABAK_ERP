import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import { QuotePdfService } from './quote-pdf.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller('quotes')
export class QuotePdfController {
  constructor(private readonly service: QuotePdfService) {}

  @Get(':id/pdf')
  @RequirePermission('quote:view')
  @ApiOperation({
    summary:
      'Render a quote as an A4 PDF (server-trusted; backgrounds intact).',
  })
  async pdf(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('quote:view') scope: PermissionScope | undefined,
  ): Promise<StreamableFile> {
    const buffer = await this.service.renderQuotePdf(id, { user, scope });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="quote-${id}.pdf"`,
      length: buffer.byteLength,
    });
  }
}
