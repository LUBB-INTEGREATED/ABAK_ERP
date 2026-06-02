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
  list(@Query() filter: PipelineFilterDto) {
    return this.pipeline.listEntries(filter);
  }

  @Get('pipeline/stats')
  @ApiOperation({
    summary: 'Pipeline totals (counts and estimated value per stage)',
  })
  stats() {
    return this.pipeline.stats();
  }

  @Post('pipeline/entries')
  @RequirePermission('pipeline:move')
  @ApiOperation({ summary: 'Add a lead or client to the pipeline' })
  create(@Body() dto: CreatePipelineEntryDto) {
    return this.pipeline.createEntry(dto);
  }

  @Get('pipeline/entries/:id')
  @ApiOperation({ summary: 'Fetch a pipeline entry with transition history' })
  findOne(@Param('id') id: string) {
    return this.pipeline.findOne(id);
  }

  @Patch('pipeline/entries/:id')
  @RequirePermission('pipeline:move')
  @ApiOperation({
    summary: 'Update owner, estimated value, probability, close date',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePipelineEntryDto) {
    return this.pipeline.updateEntry(id, dto);
  }

  @Patch('pipeline/entries/:id/stage')
  @RequirePermission('pipeline:move')
  @ApiOperation({ summary: 'Move a pipeline entry to a new stage' })
  move(
    @Param('id') id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.pipeline.moveStage(id, dto, actorId);
  }

  @Delete('pipeline/entries/:id')
  @RequirePermission('pipeline:move')
  @ApiOperation({
    summary: 'Remove a pipeline entry (does not delete the lead/client)',
  })
  remove(@Param('id') id: string) {
    return this.pipeline.deleteEntry(id);
  }

  // Field visits ---------------------------------------------------

  @Get('visits')
  @ApiOperation({ summary: 'List field visits (optionally scoped to a user)' })
  listVisits(@Query('ownerId') ownerId?: string) {
    return this.pipeline.listVisits(ownerId);
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
  updateVisit(@Param('id') id: string, @Body() dto: UpdateFieldVisitDto) {
    return this.pipeline.updateVisit(id, dto);
  }

  // Targets --------------------------------------------------------

  @Get('team/targets')
  @ApiOperation({ summary: 'List targets (optionally scoped to a user)' })
  listTargets(@Query('ownerId') ownerId?: string) {
    return this.pipeline.listTargets(ownerId);
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
