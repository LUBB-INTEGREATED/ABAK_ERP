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
import {
  ClientFilterDto,
  CreateClientDto,
  CreateFollowUpDto,
  CreateInteractionDto,
  CreateNoteDto,
  InteractionFilterDto,
  UpdateClassificationDto,
  UpdateClientDto,
  UpdateFollowUpDto,
} from './dto';

@ApiTags('clients')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly classification: ClassificationService,
  ) {}

  @Post('reclassify')
  @ApiOperation({
    summary:
      'Trigger the classification sweep (cron runs every night at 02:00)',
  })
  reclassify() {
    return this.classification.reclassifyAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a client (optionally convert a lead)' })
  create(@Body() dto: CreateClientDto, @CurrentUser('id') actorId: string) {
    return this.clients.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List clients with filters + pagination' })
  findAll(@Query() filter: ClientFilterDto) {
    return this.clients.findAll(filter);
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
  findOne(@Param('id') id: string) {
    return this.clients.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update client fields' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }

  @Patch(':id/classify')
  @ApiOperation({
    summary: 'Change classification (optionally lock from auto)',
  })
  classify(@Param('id') id: string, @Body() dto: UpdateClassificationDto) {
    return this.clients.classify(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive the client (soft delete)' })
  archive(@Param('id') id: string) {
    return this.clients.archive(id);
  }

  // Interactions ---------------------------------------------------

  @Get(':id/interactions')
  @ApiOperation({ summary: 'List interactions for a client' })
  listInteractions(
    @Param('id') id: string,
    @Query() filter: InteractionFilterDto,
  ) {
    return this.clients.listInteractions(id, filter);
  }

  @Post(':id/interactions')
  @ApiOperation({ summary: 'Log an interaction for the client' })
  addInteraction(
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.clients.addInteraction(id, dto, actorId);
  }

  // Follow-ups -----------------------------------------------------

  @Get(':id/follow-ups')
  @ApiOperation({ summary: 'List follow-ups for a client' })
  listFollowUps(@Param('id') id: string) {
    return this.clients.listFollowUps(id);
  }

  @Post(':id/follow-ups')
  @ApiOperation({ summary: 'Schedule a follow-up for the client' })
  createFollowUp(
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.clients.createFollowUp(id, dto, actorId);
  }

  @Patch('follow-ups/:followUpId')
  @ApiOperation({ summary: 'Update a follow-up (status, assignee, outcome)' })
  updateFollowUp(
    @Param('followUpId') followUpId: string,
    @Body() dto: UpdateFollowUpDto,
  ) {
    return this.clients.updateFollowUp(followUpId, dto);
  }

  // Notes ----------------------------------------------------------

  @Get(':id/notes')
  @ApiOperation({ summary: 'List client notes' })
  listNotes(@Param('id') id: string) {
    return this.clients.listNotes(id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a note to the client' })
  createNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.clients.createNote(id, dto, actorId);
  }

  @Delete('notes/:noteId')
  @ApiOperation({ summary: 'Delete a note' })
  deleteNote(@Param('noteId') noteId: string) {
    return this.clients.deleteNote(noteId);
  }
}
