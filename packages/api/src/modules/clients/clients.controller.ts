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
import { ClassificationService } from './classification.service';
import { ClientsService } from './clients.service';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import {
  ClientFilterDto,
  CreateClientDto,
  CreateFollowUpDto,
  CreateInteractionDto,
  CreateNoteDto,
  InteractionFilterDto,
  ReassignClientDto,
  UpdateClassificationDto,
  UpdateClientDto,
  UpdateFollowUpDto,
  UpdateInteractionDto,
} from './dto';

@ApiTags('clients')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
@RequirePermission('clients:view')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly classification: ClassificationService,
  ) {}

  @Post('reclassify')
  @RequirePermission('clients:edit')
  @ApiOperation({
    summary:
      'Trigger the classification sweep (cron runs every night at 02:00)',
  })
  reclassify() {
    return this.classification.reclassifyAll();
  }

  @Post()
  @RequirePermission('clients:create')
  @ApiOperation({ summary: 'Create a client (optionally convert a lead)' })
  create(@Body() dto: CreateClientDto, @CurrentUser('id') actorId: string) {
    return this.clients.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List clients with filters + pagination' })
  findAll(
    @Query() filter: ClientFilterDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:view') scope: PermissionScope | undefined,
  ) {
    return this.clients.findAll(filter, { user, scope });
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Aggregate client counts and lifetime-value average',
  })
  stats() {
    return this.clients.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a client 360° view' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:view') scope: PermissionScope | undefined,
  ) {
    return this.clients.findOne(id, { user, scope });
  }

  @Patch(':id')
  @RequirePermission('clients:edit')
  @ApiOperation({ summary: 'Update client fields' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:edit') scope: PermissionScope | undefined,
  ) {
    return this.clients.update(id, dto, { user, scope });
  }

  @Patch(':id/classify')
  @RequirePermission('clients:edit')
  @ApiOperation({
    summary: 'Change classification (optionally lock from auto)',
  })
  classify(
    @Param('id') id: string,
    @Body() dto: UpdateClassificationDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:edit') scope: PermissionScope | undefined,
  ) {
    return this.clients.classify(id, dto, { user, scope });
  }

  @Delete(':id')
  @RequirePermission('clients:edit')
  @ApiOperation({ summary: 'Archive the client (soft delete)' })
  archive(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:edit') scope: PermissionScope | undefined,
  ) {
    return this.clients.archive(id, { user, scope });
  }

  // Interactions ---------------------------------------------------

  @Get(':id/interactions')
  @ApiOperation({ summary: 'List interactions for a client' })
  listInteractions(
    @Param('id') id: string,
    @Query() filter: InteractionFilterDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:view') scope: PermissionScope | undefined,
  ) {
    return this.clients.listInteractions(id, filter, { user, scope });
  }

  @Post(':id/interactions')
  @RequirePermission('comms:log')
  @ApiOperation({ summary: 'Log an interaction for the client' })
  addInteraction(
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.addInteraction(id, dto, actorId, { user, scope });
  }

  @Patch(':id/interactions/:interactionId')
  @RequirePermission('comms:log')
  @ApiOperation({
    summary: 'Edit an interaction (locked after 24h — manager override only)',
  })
  updateInteraction(
    @Param('id') id: string,
    @Param('interactionId') interactionId: string,
    @Body() dto: UpdateInteractionDto,
    @CurrentUser() actor: { id: string; role: string },
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.updateInteraction(id, interactionId, dto, actor, {
      user,
      scope,
    });
  }

  @Delete(':id/interactions/:interactionId')
  @RequirePermission('comms:log')
  @ApiOperation({
    summary:
      'Delete an interaction (locked after 24h — managers + admins only)',
  })
  deleteInteraction(
    @Param('id') id: string,
    @Param('interactionId') interactionId: string,
    @CurrentUser() actor: { id: string; role: string },
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.deleteInteraction(id, interactionId, actor, {
      user,
      scope,
    });
  }

  @Post(':id/reassign')
  @RequirePermission('clients:edit')
  @ApiOperation({
    summary: 'Reassign client account manager (BR-19 — reason required)',
  })
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignClientDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:edit') scope: PermissionScope | undefined,
  ) {
    return this.clients.reassign(id, dto, actorId, { user, scope });
  }

  // Follow-ups -----------------------------------------------------

  @Get(':id/follow-ups')
  @ApiOperation({ summary: 'List follow-ups for a client' })
  listFollowUps(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:view') scope: PermissionScope | undefined,
  ) {
    return this.clients.listFollowUps(id, { user, scope });
  }

  @Post(':id/follow-ups')
  @RequirePermission('comms:log')
  @ApiOperation({ summary: 'Schedule a follow-up for the client' })
  createFollowUp(
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.createFollowUp(id, dto, actorId, { user, scope });
  }

  @Patch('follow-ups/:followUpId')
  @RequirePermission('comms:log')
  @ApiOperation({ summary: 'Update a follow-up (status, assignee, outcome)' })
  updateFollowUp(
    @Param('followUpId') followUpId: string,
    @Body() dto: UpdateFollowUpDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.updateFollowUp(followUpId, dto, { user, scope });
  }

  // Notes ----------------------------------------------------------

  @Get(':id/notes')
  @ApiOperation({ summary: 'List client notes' })
  listNotes(
    @Param('id') id: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('clients:view') scope: PermissionScope | undefined,
  ) {
    return this.clients.listNotes(id, { user, scope });
  }

  @Post(':id/notes')
  @RequirePermission('comms:log')
  @ApiOperation({ summary: 'Add a note to the client' })
  createNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.createNote(id, dto, actorId, { user, scope });
  }

  @Delete('notes/:noteId')
  @RequirePermission('comms:log')
  @ApiOperation({ summary: 'Delete a note' })
  deleteNote(
    @Param('noteId') noteId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('comms:log') scope: PermissionScope | undefined,
  ) {
    return this.clients.deleteNote(noteId, { user, scope });
  }
}
