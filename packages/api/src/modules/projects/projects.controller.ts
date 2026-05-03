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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AdjustPhaseProgressDto,
  ClosureGateDto,
  CompletePhaseDto,
  CreateDependencyDto,
  CreatePhaseDto,
  CreateProjectDto,
  CreateTaskDto,
  ListProjectsDto,
  ReassignPhaseOwnerDto,
  TransitionProjectStatusDto,
  TransitionTaskStatusDto,
  UpdatePhaseDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller()
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // Projects ------------------------------------------------------

  @Post('projects')
  @ApiOperation({ summary: 'Create a project from a purchase order' })
  create(@Body() dto: CreateProjectDto, @CurrentUser('id') actorId: string) {
    return this.service.create(dto, actorId);
  }

  @Get('projects/stats')
  @ApiOperation({ summary: 'Project counts + AT_RISK stats' })
  stats() {
    return this.service.stats();
  }

  @Get('projects/available-pos')
  @ApiOperation({
    summary: 'List ACTIVE purchase orders without a linked project',
  })
  availablePos() {
    return this.service.listAvailablePurchaseOrders();
  }

  @Get('projects/eligible-pms')
  @ApiOperation({
    summary:
      'List users eligible to be a Project Manager (Admin / Tech / Sales managers)',
  })
  eligiblePms() {
    return this.service.listEligiblePms();
  }

  @Get('projects/resources/workload')
  @ApiOperation({
    summary: 'Get resource workload per employee across active projects',
  })
  resourceWorkload() {
    return this.service.getResourceWorkload();
  }

  @Get('projects')
  @ApiOperation({ summary: 'List projects' })
  list(@Query() query: ListProjectsDto) {
    return this.service.list(query);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get project detail with phases + tasks' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('projects/:id')
  @ApiOperation({ summary: 'Update project basics' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(id, dto);
  }

  @Patch('projects/:id/status')
  @ApiOperation({ summary: 'Transition project status' })
  transitionStatus(
    @Param('id') id: string,
    @Body() dto: TransitionProjectStatusDto,
  ) {
    return this.service.transitionStatus(id, dto);
  }

  // Phases --------------------------------------------------------

  @Post('projects/:id/phases')
  @ApiOperation({ summary: 'Add a phase to a project' })
  addPhase(@Param('id') id: string, @Body() dto: CreatePhaseDto) {
    return this.service.addPhase(id, dto);
  }

  @Patch('projects/:id/phases/:phaseId')
  @ApiOperation({ summary: 'Update phase' })
  updatePhase(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.service.updatePhase(id, phaseId, dto);
  }

  @Patch('projects/:id/phases/:phaseId/reassign-owner')
  @ApiOperation({ summary: 'Reassign phase owner (BR-13, requires reason)' })
  reassignOwner(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: ReassignPhaseOwnerDto,
  ) {
    return this.service.reassignPhaseOwner(id, phaseId, dto);
  }

  @Patch('projects/:id/phases/:phaseId/complete')
  @ApiOperation({ summary: 'Mark phase complete (BR-14 — evidence required)' })
  completePhase(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: CompletePhaseDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.completePhase(id, phaseId, dto, actorId);
  }

  @Patch('projects/:id/phases/:phaseId/adjust-progress')
  @ApiOperation({ summary: 'PM manual progress override' })
  adjustProgress(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: AdjustPhaseProgressDto,
  ) {
    return this.service.adjustPhaseProgress(id, phaseId, dto);
  }

  // Tasks ---------------------------------------------------------

  @Post('projects/:id/phases/:phaseId/tasks')
  @ApiOperation({ summary: 'Add a task to a phase' })
  addTask(
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.service.addTask(id, phaseId, dto);
  }

  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Update task' })
  updateTask(@Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.service.updateTask(taskId, dto);
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Transition task status (dependency-aware)' })
  transitionTaskStatus(
    @Param('taskId') taskId: string,
    @Body() dto: TransitionTaskStatusDto,
  ) {
    return this.service.transitionTaskStatus(taskId, dto);
  }

  @Post('tasks/:taskId/dependencies')
  @ApiOperation({ summary: 'Add a dependency (cycle-detected)' })
  addDependency(
    @Param('taskId') taskId: string,
    @Body() dto: CreateDependencyDto,
  ) {
    return this.service.addDependency(taskId, dto);
  }

  @Delete('tasks/:taskId/dependencies/:blockerId')
  @ApiOperation({ summary: 'Remove a dependency' })
  removeDependency(
    @Param('taskId') taskId: string,
    @Param('blockerId') blockerId: string,
  ) {
    return this.service.removeDependency(taskId, blockerId);
  }

  // Closure -------------------------------------------------------

  @Post('projects/:id/initiate-closure')
  @ApiOperation({ summary: 'Initiate project closure (status → CLOSING)' })
  initiateClosure(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.service.initiateClosure(id, actorId);
  }

  @Patch('projects/:id/closure-checklist')
  @ApiOperation({ summary: 'Flip a closure gate (role-gated per PART 7)' })
  setClosureGate(
    @Param('id') id: string,
    @Body() dto: ClosureGateDto,
    @CurrentUser() actor: { id: string; role: string },
  ) {
    return this.service.setClosureGate(id, dto, actor);
  }
}
