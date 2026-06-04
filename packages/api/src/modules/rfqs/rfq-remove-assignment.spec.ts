import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from '../quotes/quotes.service';
import { RfqAssignmentsService } from './rfq-assignments.service';
import type { RfqsService } from './rfqs.service';

// RV3b-5 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). Removing a co-pricer's assignment must clear the matching
// QuoteDepartmentSection.pricerId so the removed user loses read access to the
// quote (the read-scope keys off section.pricerId).

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const rfqsStub = {
  assertCanAccess: async () => undefined,
} as unknown as RfqsService;

const assignments = new RfqAssignmentsService(prisma, rfqsStub);
const quotes = new QuotesService(prisma, notifications, pricingPolicy);

const TAG = `TEST-RV3B5-${Date.now()}`;
const trash = {
  quoteIds: [] as string[],
  rfqIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
  userIds: [] as string[],
};

after(async () => {
  for (const id of trash.rfqIds)
    await prisma.rfqAssignment.deleteMany({ where: { rfqId: id } });
  for (const id of trash.rfqIds)
    await prisma.rfq.updateMany({ where: { id }, data: { quoteId: null } });
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.rfqIds) await prisma.rfq.deleteMany({ where: { id } });
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('RV3b-5: removing a co-pricer clears the section pricer + revokes read access', async () => {
  const cat = await prisma.serviceCategory.findFirstOrThrow({
    select: { id: true },
  });
  const coUser = await prisma.user.create({
    data: {
      email: `${TAG}-co@example.com`,
      password: 'x',
      firstName: 'Co',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  trash.userIds.push(coUser.id);

  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}`,
      contactName: 'Remove Assign Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);
  const opp = await prisma.pipelineEntry.create({
    data: { clientId: client.id },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}`,
      clientId: client.id,
      title: 'Remove assign',
      status: 'DRAFT',
      departmentSections: {
        create: [{ departmentId: cat.id, isLead: false, pricerId: coUser.id }],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}`,
      opportunityId: opp.id,
      clientId: client.id,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: 'PRICING',
      quoteId: quote.id,
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);
  const assignment = await prisma.rfqAssignment.create({
    data: {
      rfqId: rfq.id,
      departmentId: cat.id,
      assigneeId: coUser.id,
      isLeadPricer: false,
    },
    select: { id: true },
  });

  const coCtx = { user: { id: coUser.id }, scope: 'DEPARTMENT' as const };
  // Before removal the co-pricer can read the quote (section pricer).
  const before = await quotes.findOne(quote.id, coCtx);
  assert.equal(before.id, quote.id, 'co-pricer reads the quote before removal');

  await assignments.removeAssignment(rfq.id, assignment.id);

  const section = await prisma.quoteDepartmentSection.findFirst({
    where: { quoteId: quote.id, departmentId: cat.id },
    select: { pricerId: true },
  });
  assert.equal(section?.pricerId, null, 'section pricer cleared on removal');

  await assert.rejects(
    () => quotes.findOne(quote.id, coCtx),
    (e: unknown) => e instanceof ForbiddenException,
    'removed co-pricer can no longer read the quote',
  );
});
