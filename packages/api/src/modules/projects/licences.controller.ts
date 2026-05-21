import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  type CreateLicenceDto,
  LicencesService,
  type UpdateLicenceDto,
} from './licences.service';

@ApiTags('project-licences')
@Controller('projects/:projectId/licences')
export class LicencesController {
  constructor(private readonly licences: LicencesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List government licences attached to this project (project-scoped Licence model added 2026-05-21).',
  })
  list(@Param('projectId') projectId: string) {
    return this.licences.list(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new licence record on this project.' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateLicenceDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.licences.create(projectId, dto, actorId);
  }

  @Patch(':licenceId')
  @ApiOperation({
    summary:
      'Update licence (status, dates, notes, dependency wiring). Status → ISSUED cascades to unblock dependent phases.',
  })
  update(
    @Param('projectId') projectId: string,
    @Param('licenceId') licenceId: string,
    @Body() dto: UpdateLicenceDto,
  ) {
    return this.licences.update(projectId, licenceId, dto);
  }

  @Delete(':licenceId')
  @ApiOperation({ summary: 'Soft delete a licence record.' })
  remove(
    @Param('projectId') projectId: string,
    @Param('licenceId') licenceId: string,
  ) {
    return this.licences.softDelete(projectId, licenceId);
  }
}
