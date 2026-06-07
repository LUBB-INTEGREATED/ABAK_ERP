import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import {
  CreateGovTransactionDto,
  ListGovTransactionsDto,
  LogCommentDto,
  LogVisitDto,
  RespondCommentDto,
  TransitionGovTxStatusDto,
  UpdateGovTransactionDto,
  UploadDocumentDto,
  WeeklyStatusUpdateDto,
} from './dto';
import { GovTransactionsService } from './gov-transactions.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('gov-transactions')
@Controller('gov-transactions')
@RequirePermission('gov:view')
export class GovTransactionsController {
  constructor(private readonly service: GovTransactionsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Gov transactions stats' })
  stats(
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:view') scope: PermissionScope | undefined,
  ) {
    return this.service.stats({ user, scope });
  }

  @Get('pro/dashboard')
  @ApiOperation({ summary: 'PRO home — open tx + today visits' })
  proDashboard(@CurrentUser('id') actorId: string) {
    return this.service.proDashboard(actorId);
  }

  @Post()
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Create a gov transaction (BR-15)' })
  create(
    @Body() dto: CreateGovTransactionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List gov transactions' })
  list(
    @Query() query: ListGovTransactionsDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:view') scope: PermissionScope | undefined,
  ) {
    return this.service.list(query, { user, scope });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Gov transaction detail' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:view') scope: PermissionScope | undefined,
  ) {
    return this.service.findOne(id, { user, scope });
  }

  @Patch(':id')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Update gov transaction' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGovTransactionDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.update(id, dto, { user, scope });
  }

  @Patch(':id/status')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Transition status' })
  transitionStatus(
    @Param('id') id: string,
    @Body() dto: TransitionGovTxStatusDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.transitionStatus(id, dto, { user, scope });
  }

  @Post(':id/visits')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Log PRO visit (must be same day — BR-16)' })
  logVisit(
    @Param('id') id: string,
    @Body() dto: LogVisitDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.logVisit(id, dto, actorId, { user, scope });
  }

  @Post(':id/comments')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Log authority comment' })
  logComment(
    @Param('id') id: string,
    @Body() dto: LogCommentDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.logComment(id, dto, { user, scope });
  }

  @Patch('comments/:commentId/respond')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Respond to an authority comment' })
  respondToComment(
    @Param('commentId') commentId: string,
    @Body() dto: RespondCommentDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.respondToComment(commentId, dto, actorId, {
      user,
      scope,
    });
  }

  @Post(':id/documents')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Attach a document' })
  uploadDocument(
    @Param('id') id: string,
    @Body() dto: UploadDocumentDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.uploadDocument(id, dto, actorId, { user, scope });
  }

  @Post(':id/weekly-status-update')
  @RequirePermission('gov:manage')
  @ApiOperation({ summary: 'Mark weekly status update' })
  weeklyStatusUpdate(
    @Param('id') id: string,
    @Body() dto: WeeklyStatusUpdateDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('gov:manage') scope: PermissionScope | undefined,
  ) {
    return this.service.weeklyStatusUpdate(id, dto, { user, scope });
  }
}
