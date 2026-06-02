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
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import {
  type CreateLicenceDto,
  LicencesService,
  type UpdateLicenceDto,
} from './licences.service';

@ApiTags('project-licences')
@Controller('projects/:projectId/licences')
@RequirePermission('project:view')
export class LicencesController {
  constructor(private readonly licences: LicencesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List government licences attached to this project (project-scoped Licence model added 2026-05-21).',
  })
  list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('project:view') scope: PermissionScope | undefined,
  ) {
    return this.licences.list(projectId, { user, scope });
  }

  @Post()
  @RequirePermission('project:manage_licences')
  @ApiOperation({ summary: 'Create a new licence record on this project.' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateLicenceDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('project:manage_licences')
    scope: PermissionScope | undefined,
  ) {
    return this.licences.create(projectId, dto, actorId, { user, scope });
  }

  @Patch(':licenceId')
  @RequirePermission('project:manage_licences')
  @ApiOperation({
    summary:
      'Update licence (status, dates, notes, dependency wiring). Status → ISSUED cascades to unblock dependent phases.',
  })
  update(
    @Param('projectId') projectId: string,
    @Param('licenceId') licenceId: string,
    @Body() dto: UpdateLicenceDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('project:manage_licences')
    scope: PermissionScope | undefined,
  ) {
    return this.licences.update(projectId, licenceId, dto, { user, scope });
  }

  @Delete(':licenceId')
  @RequirePermission('project:manage_licences')
  @ApiOperation({ summary: 'Soft delete a licence record.' })
  remove(
    @Param('projectId') projectId: string,
    @Param('licenceId') licenceId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('project:manage_licences')
    scope: PermissionScope | undefined,
  ) {
    return this.licences.softDelete(projectId, licenceId, { user, scope });
  }
}

/**
 * Separate controller for CEO override on phase ↔ licence dependencies.
 * Lives under /projects/:projectId/phases/:phaseId/ so the URL reads
 * naturally as a phase action, not a licence action.
 */
@ApiTags('project-phase-licence-overrides')
@Controller('projects/:projectId/phases/:phaseId/licence-override')
export class PhaseLicenceOverrideController {
  constructor(private readonly licences: LicencesService) {}

  @Post()
  @RequirePermission('project:licence_override')
  @ApiOperation({
    summary:
      'CEO override: allow a phase to start before its blocking licences are issued. Justification ≥ 20 chars required and is permanently logged.',
  })
  override(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: { justification: string },
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('project:licence_override')
    scope: PermissionScope | undefined,
  ) {
    return this.licences.overridePhaseLicenceBlock(
      projectId,
      phaseId,
      dto,
      actorId,
      { user, scope },
    );
  }

  @Delete()
  @RequirePermission('project:manage_licences')
  @ApiOperation({
    summary:
      'Clear a CEO override (mistake, or licence is now issued so override no longer needed).',
  })
  clear(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('project:manage_licences')
    scope: PermissionScope | undefined,
  ) {
    return this.licences.clearPhaseLicenceOverride(projectId, phaseId, {
      user,
      scope,
    });
  }
}
