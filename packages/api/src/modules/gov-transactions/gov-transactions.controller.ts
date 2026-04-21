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

@ApiTags('gov-transactions')
@Controller('gov-transactions')
export class GovTransactionsController {
  constructor(private readonly service: GovTransactionsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Gov transactions stats' })
  stats() {
    return this.service.stats();
  }

  @Get('pro/dashboard')
  @ApiOperation({ summary: 'PRO home — open tx + today visits' })
  proDashboard(@CurrentUser('id') actorId: string) {
    return this.service.proDashboard(actorId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a gov transaction (BR-15)' })
  create(
    @Body() dto: CreateGovTransactionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List gov transactions' })
  list(@Query() query: ListGovTransactionsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Gov transaction detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update gov transaction' })
  update(@Param('id') id: string, @Body() dto: UpdateGovTransactionDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition status' })
  transitionStatus(
    @Param('id') id: string,
    @Body() dto: TransitionGovTxStatusDto,
  ) {
    return this.service.transitionStatus(id, dto);
  }

  @Post(':id/visits')
  @ApiOperation({ summary: 'Log PRO visit (must be same day — BR-16)' })
  logVisit(
    @Param('id') id: string,
    @Body() dto: LogVisitDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.logVisit(id, dto, actorId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Log authority comment' })
  logComment(@Param('id') id: string, @Body() dto: LogCommentDto) {
    return this.service.logComment(id, dto);
  }

  @Patch('comments/:commentId/respond')
  @ApiOperation({ summary: 'Respond to an authority comment' })
  respondToComment(
    @Param('commentId') commentId: string,
    @Body() dto: RespondCommentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.respondToComment(commentId, dto, actorId);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Attach a document' })
  uploadDocument(
    @Param('id') id: string,
    @Body() dto: UploadDocumentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.uploadDocument(id, dto, actorId);
  }

  @Post(':id/weekly-status-update')
  @ApiOperation({ summary: 'Mark weekly status update' })
  weeklyStatusUpdate(
    @Param('id') id: string,
    @Body() dto: WeeklyStatusUpdateDto,
  ) {
    return this.service.weeklyStatusUpdate(id, dto);
  }
}
