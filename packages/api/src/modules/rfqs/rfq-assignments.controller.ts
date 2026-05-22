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
  @ApiOperation({
    summary:
      'List per-department pricer assignments (2026-05-21 process correction).',
  })
  listAssignments(@Param('rfqId') rfqId: string) {
    return this.service.listAssignments(rfqId);
  }

  @Post('assignments')
  @ApiOperation({
    summary:
      'Create a per-department pricer assignment. If isLeadPricer = true, clears the flag on other rows.',
  })
  createAssignment(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.service.createAssignment(rfqId, dto);
  }

  @Patch('assignments/:assignmentId')
  @ApiOperation({
    summary:
      'Update assignment (re-assign person, toggle Lead Pricer, change status).',
  })
  updateAssignment(
    @Param('rfqId') rfqId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.service.updateAssignment(rfqId, assignmentId, dto);
  }

  @Delete('assignments/:assignmentId')
  @ApiOperation({
    summary:
      'Remove an assignment. Cannot remove the Lead Pricer — designate another assignee first.',
  })
  removeAssignment(
    @Param('rfqId') rfqId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.service.removeAssignment(rfqId, assignmentId);
  }

  // Document requests (engineer → sales person).

  @Get('doc-requests')
  @ApiOperation({
    summary:
      'List document requests raised by pricers while building this quote.',
  })
  listDocRequests(@Param('rfqId') rfqId: string) {
    return this.service.listDocRequests(rfqId);
  }

  @Post('doc-requests')
  @ApiOperation({
    summary:
      'Request an additional document from the client; routes to the sales person.',
  })
  createDocRequest(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateDocRequestDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.createDocRequest(rfqId, dto, actorId);
  }

  @Patch('doc-requests/:requestId')
  @ApiOperation({
    summary: 'Mark a doc request resolved (or attach response / cancel).',
  })
  updateDocRequest(
    @Param('rfqId') rfqId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateDocRequestDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.updateDocRequest(rfqId, requestId, dto, actorId);
  }

  // Site visit requests.

  @Get('site-visit-requests')
  @ApiOperation({
    summary: 'List site-visit requests on this RFQ.',
  })
  listSiteVisitRequests(@Param('rfqId') rfqId: string) {
    return this.service.listSiteVisitRequests(rfqId);
  }

  @Post('site-visit-requests')
  @ApiOperation({
    summary:
      'Request a site visit before pricing. Sales person is notified for first contact; engineer can then coordinate logistics directly with the client.',
  })
  createSiteVisitRequest(
    @Param('rfqId') rfqId: string,
    @Body() dto: CreateSiteVisitRequestDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.service.createSiteVisitRequest(rfqId, dto, actorId);
  }

  @Patch('site-visit-requests/:requestId')
  @ApiOperation({
    summary: 'Update site-visit request (schedule, complete, cancel).',
  })
  updateSiteVisitRequest(
    @Param('rfqId') rfqId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateSiteVisitRequestDto,
  ) {
    return this.service.updateSiteVisitRequest(rfqId, requestId, dto);
  }
}
