import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import {
  CreateFieldVisitDto,
  CreatePipelineEntryDto,
  CreateTargetDto,
  MoveStageDto,
  PipelineFilterDto,
  UpdateFieldVisitDto,
  UpdatePipelineEntryDto,
} from './dto';
import { PipelineService } from './pipeline.service';

@ApiTags('pipeline')
@ApiBearerAuth('JWT-auth')
@RequirePermission('pipeline:view')
@Controller()
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get('pipeline')
  @ApiOperation({ summary: 'List pipeline entries grouped by stage' })
  list(
    @Query() filter: PipelineFilterDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:view') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.listEntries(filter, { user, scope });
  }

  @Get('pipeline/stats')
  @ApiOperation({
    summary: 'Pipeline totals (counts and estimated value per stage)',
  })
  stats(
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:view') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.stats({ user, scope });
  }

  @Post('pipeline/entries')
  @RequirePermission('pipeline:move')
  @ApiOperation({ summary: 'Add a lead or client to the pipeline' })
  create(
    @Body() dto: CreatePipelineEntryDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.pipeline.createEntry(dto, actorId);
  }

  @Get('pipeline/entries/:id')
  @ApiOperation({ summary: 'Fetch a pipeline entry with transition history' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:view') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.findOne(id, { user, scope });
  }

  @Patch('pipeline/entries/:id')
  @RequirePermission('pipeline:move')
  @ApiOperation({
    summary: 'Update owner, estimated value, probability, close date',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePipelineEntryDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:move') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.updateEntry(id, dto, { user, scope });
  }

  @Patch('pipeline/entries/:id/stage')
  @RequirePermission('pipeline:move')
  @ApiOperation({ summary: 'Move a pipeline entry to a new stage' })
  move(
    @Param('id') id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:move') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.moveStage(id, dto, actorId, { user, scope });
  }

  @Delete('pipeline/entries/:id')
  @RequirePermission('pipeline:move')
  @ApiOperation({
    summary: 'Remove a pipeline entry (does not delete the lead/client)',
  })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:move') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.deleteEntry(id, { user, scope });
  }

  // Field visits ---------------------------------------------------

  @Get('visits')
  @ApiOperation({ summary: 'List field visits (optionally scoped to a user)' })
  listVisits(
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:view') scope: PermissionScope | undefined,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.pipeline.listVisits(ownerId, { user, scope });
  }

  @Post('visits')
  @RequirePermission('pipeline:log_visit')
  @ApiOperation({ summary: 'Schedule a field visit' })
  createVisit(
    @Body() dto: CreateFieldVisitDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.pipeline.createVisit(dto, actorId);
  }

  @Patch('visits/:id')
  @RequirePermission('pipeline:log_visit')
  @ApiOperation({
    summary: 'Update a field visit (close it out, add findings)',
  })
  updateVisit(
    @Param('id') id: string,
    @Body() dto: UpdateFieldVisitDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:log_visit') scope: PermissionScope | undefined,
  ) {
    return this.pipeline.updateVisit(id, dto, { user, scope });
  }

  // Targets --------------------------------------------------------

  @Get('team/targets')
  @ApiOperation({ summary: 'List targets (optionally scoped to a user)' })
  listTargets(
    @CurrentUser() user: ScopeUser,
    @CurrentScope('pipeline:view') scope: PermissionScope | undefined,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.pipeline.listTargets(ownerId, { user, scope });
  }

  @Post('team/targets')
  @RequirePermission('pipeline:move')
  @ApiOperation({
    summary: 'Upsert a target for a user/period/type combination',
  })
  createTarget(@Body() dto: CreateTargetDto) {
    return this.pipeline.createTarget(dto);
  }
}
