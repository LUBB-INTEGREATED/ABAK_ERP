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
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentScope } from '../auth/decorators/current-scope.decorator';
import type { PermissionScope, ScopeUser } from '../auth/scope.util';
import {
  type CreateAssignmentDto,
  type CreateDocRequestDto,
  type CreateSiteVisitRequestDto,
  RfqAssignmentsService,
  type UpdateAssignmentDto,
  type UpdateDocRequestDto,
  type UpdateSiteVisitRequestDto,
} from './rfq-assignments.service';

@ApiTags('rfq-assignments')
@Controller('rfqs/:rfqId')
export class RfqAssignmentsController {
  constructor(private readonly service: RfqAssignmentsService) {}

  // Per-department pricer assignments + Lead Pricer designation.

  @Get('assignments')
  @RequirePermission('rfq:view')
  @ApiOperation({
    summary:
      'List per-department pricer assignments (2026-05-21 process correction).',
  })
  listAssignments(
    @Param('rfqId') rfqId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:view') scope: PermissionScope | undefined,
  ) {
    return this.service.listAssignments(rfqId, { user, scope });
  }

  @Post('assignments')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({
    summary:
      'Create a per-department pricer assignment. If isLeadPricer = true, clears the flag on other rows.',
  })
  createAssignment(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:assign_pricers') scope: PermissionScope | undefined,
  ) {
    return this.service.createAssignment(rfqId, dto, { user, scope });
  }

  @Patch('assignments/:assignmentId')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({
    summary:
      'Update assignment (re-assign person, toggle Lead Pricer, change status).',
  })
  updateAssignment(
    @Param('rfqId') rfqId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:assign_pricers') scope: PermissionScope | undefined,
  ) {
    return this.service.updateAssignment(rfqId, assignmentId, dto, {
      user,
      scope,
    });
  }

  @Delete('assignments/:assignmentId')
  @RequirePermission('rfq:assign_pricers')
  @ApiOperation({
    summary:
      'Remove an assignment. Cannot remove the Lead Pricer — designate another assignee first.',
  })
  removeAssignment(
    @Param('rfqId') rfqId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:assign_pricers') scope: PermissionScope | undefined,
  ) {
    return this.service.removeAssignment(rfqId, assignmentId, { user, scope });
  }

  // Document requests (engineer → sales person).

  @Get('doc-requests')
  @RequirePermission('rfq:view')
  @ApiOperation({
    summary:
      'List document requests raised by pricers while building this quote.',
  })
  listDocRequests(
    @Param('rfqId') rfqId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:view') scope: PermissionScope | undefined,
  ) {
    return this.service.listDocRequests(rfqId, { user, scope });
  }

  @Post('doc-requests')
  @RequirePermission('rfq:request_docs')
  @ApiOperation({
    summary:
      'Request an additional document from the client; routes to the sales person.',
  })
  createDocRequest(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateDocRequestDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request_docs') scope: PermissionScope | undefined,
  ) {
    return this.service.createDocRequest(rfqId, dto, actorId, { user, scope });
  }

  @Patch('doc-requests/:requestId')
  @RequirePermission('rfq:request_docs')
  @ApiOperation({
    summary: 'Mark a doc request resolved (or attach response / cancel).',
  })
  updateDocRequest(
    @Param('rfqId') rfqId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateDocRequestDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request_docs') scope: PermissionScope | undefined,
  ) {
    return this.service.updateDocRequest(rfqId, requestId, dto, actorId, {
      user,
      scope,
    });
  }

  // Site visit requests.

  @Get('site-visit-requests')
  @RequirePermission('rfq:view')
  @ApiOperation({
    summary: 'List site-visit requests on this RFQ.',
  })
  listSiteVisitRequests(
    @Param('rfqId') rfqId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:view') scope: PermissionScope | undefined,
  ) {
    return this.service.listSiteVisitRequests(rfqId, { user, scope });
  }

  @Post('site-visit-requests')
  @RequirePermission('rfq:request_docs')
  @ApiOperation({
    summary:
      'Request a site visit before pricing. Sales person is notified for first contact; engineer can then coordinate logistics directly with the client.',
  })
  createSiteVisitRequest(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateSiteVisitRequestDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request_docs') scope: PermissionScope | undefined,
  ) {
    return this.service.createSiteVisitRequest(rfqId, dto, actorId, {
      user,
      scope,
    });
  }

  @Patch('site-visit-requests/:requestId')
  @RequirePermission('rfq:request_docs')
  @ApiOperation({
    summary: 'Update site-visit request (schedule, complete, cancel).',
  })
  updateSiteVisitRequest(
    @Param('rfqId') rfqId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateSiteVisitRequestDto,
    @CurrentUser() user: ScopeUser,
    @CurrentScope('rfq:request_docs') scope: PermissionScope | undefined,
  ) {
    return this.service.updateSiteVisitRequest(rfqId, requestId, dto, {
      user,
      scope,
    });
  }
}
