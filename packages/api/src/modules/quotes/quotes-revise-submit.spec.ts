import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';
import type { CreateQuoteDto, SubmitQuoteDto } from './dto';

// DM-8 / DM-9 regression tests. Runs against the live dev Postgres (DATABASE_URL
// via --env-file). Instantiates QuotesService directly with a real Prisma client
// and inert stubs — the DM-9 validations throw before any notifier/policy call.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const audit = { log: async () => undefined } as unknown as AuditService;
const service = new QuotesService(prisma, notifications, pricingPolicy, audit);

const TAG = `TEST-${Date.now()}`;
const trash = {
  rfqIds: [] as string[],
  quoteIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
};

async function seedClient(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Revise/Submit Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  return c.id;
}

async function departmentIds(): Promise<string[]> {
  const cats = await prisma.serviceCategory.findMany({
    select: { id: true },
    take: 2,
  });
  if (!cats.length)
    throw new Error('No ServiceCategory in DB to use as a dept');
  return cats.map((c) => c.id);
}

async function aUserId(): Promise<string> {
  const u = await prisma.user.findFirst({ select: { id: true } });
  if (!u) throw new Error('No User in DB to use as the actor');
  return u.id;
}

after(async () => {
  for (const id of trash.rfqIds) await prisma.rfq.deleteMany({ where: { id } });
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DM-8: revise() repoints rfq.quoteId to the new version and sections survive', async () => {
  const clientId = await seedClient();
  const [departmentId] = await departmentIds();

  const opp = await prisma.pipelineEntry.create({
    data: { clientId },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}`,
      opportunityId: opp.id,
      clientId,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: 'PRICING',
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}`,
      clientId,
      title: 'Revision parent',
      status: QuoteStatus.APPROVED,
      subtotal: 1000,
      totalAmount: 1000,
      // RV-1: technical scope that must survive a revision.
      scopeOfWork: 'Structural design of the mezzanine',
      deliverables: 'Stamped drawings + BOQ',
      exclusions: 'Soil testing',
      assumptions: 'Existing as-built is accurate',
      numberOfRevisions: 2,
      departmentSections: { create: [{ departmentId }] },
    },
    select: { id: true, departmentSections: { select: { id: true } } },
  });
  trash.quoteIds.push(quote.id);
  const sectionId = quote.departmentSections[0].id;
  await prisma.quoteItem.create({
    data: {
      quoteId: quote.id,
      departmentId,
      sectionId,
      description: 'Priced line',
      quantity: 1,
      unitPrice: 1000,
      subtotal: 1000,
      position: 0,
    },
  });
  await prisma.rfq.update({
    where: { id: rfq.id },
    data: { quoteId: quote.id },
  });

  const actorId = await aUserId();
  const next = await service.revise(quote.id, actorId);
  trash.quoteIds.push(next.id);

  const reloadedRfq = await prisma.rfq.findUnique({
    where: { id: rfq.id },
    select: { quoteId: true },
  });
  assert.equal(
    reloadedRfq?.quoteId,
    next.id,
    'rfq.quoteId is repointed to the latest revision',
  );
  assert.equal(next.version, 2, 'new version is parent.version + 1');
  assert.equal(
    next.departmentSections.length,
    1,
    'the department section survives the revision',
  );
  const nextItem = next.items.find((i) => i.sectionId);
  if (!nextItem) throw new Error('revision lost the section-grouped item');
  assert.equal(
    nextItem.sectionId,
    next.departmentSections[0].id,
    'item.sectionId points at the NEW section (remapped)',
  );
  assert.equal(
    nextItem.departmentId,
    departmentId,
    'item.departmentId carried',
  );

  // RV-1: the technical-scope fields must carry to the revision.
  assert.equal(next.scopeOfWork, 'Structural design of the mezzanine');
  assert.equal(next.deliverables, 'Stamped drawings + BOQ');
  assert.equal(next.exclusions, 'Soil testing');
  assert.equal(next.assumptions, 'Existing as-built is accurate');
  assert.equal(next.numberOfRevisions, 2);
});

test('RV-16: a created item is grouped under its department section', async () => {
  const clientId = await seedClient();
  const [departmentId] = await departmentIds();

  const created = await service.create(
    {
      clientId,
      title: 'Section grouping',
      items: [{ description: 'L1', quantity: 1, unitPrice: 100, departmentId }],
    } as unknown as CreateQuoteDto,
    undefined,
  );
  trash.quoteIds.push(created.id);

  const item = await prisma.quoteItem.findFirst({
    where: { quoteId: created.id },
    select: { sectionId: true, departmentId: true },
  });
  assert.ok(
    item?.sectionId,
    'item received a sectionId (derived from departmentId)',
  );
  const section = await prisma.quoteDepartmentSection.findUnique({
    where: { id: item.sectionId! },
    select: { quoteId: true, departmentId: true },
  });
  assert.equal(section?.quoteId, created.id, 'section belongs to the quote');
  assert.equal(
    section?.departmentId,
    departmentId,
    'section is for the item department',
  );
});

test('RV-13: concurrent revise() mints exactly one revision; the loser is rejected', async () => {
  const clientId = await seedClient();
  const opp = await prisma.pipelineEntry.create({
    data: { clientId },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}-REV`,
      opportunityId: opp.id,
      clientId,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: 'PRICING',
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);
  const parent = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-REVPARENT`,
      clientId,
      title: 'Concurrent revise parent',
      status: QuoteStatus.APPROVED,
      subtotal: 1000,
      totalAmount: 1000,
    },
    select: { id: true },
  });
  trash.quoteIds.push(parent.id);
  await prisma.rfq.update({
    where: { id: rfq.id },
    data: { quoteId: parent.id },
  });
  const actorId = await aUserId();

  const results = await Promise.allSettled([
    service.revise(parent.id, actorId),
    service.revise(parent.id, actorId),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1, 'exactly one revise succeeds');
  assert.equal(rejected.length, 1, 'the other revise is rejected');
  const reason = (rejected[0] as PromiseRejectedResult).reason as Error;
  assert.match(reason?.message ?? '', /already revised/i);
  for (const r of fulfilled) {
    if (r.status === 'fulfilled') trash.quoteIds.push(r.value.id);
  }
  const children = await prisma.quote.count({
    where: { parentQuoteId: parent.id },
  });
  assert.equal(children, 1, 'exactly one revision minted — no orphan');
});

test('DM-9: submit() rejects a quote with an unpriced department section', async () => {
  const clientId = await seedClient();
  const [deptA, deptB] = await departmentIds();
  if (!deptB) return; // needs two distinct departments

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-UNPRICED`,
      clientId,
      title: 'Unpriced section',
      status: QuoteStatus.DRAFT,
      subtotal: 1000,
      totalAmount: 1000,
      paymentMilestones: {
        create: [
          { description: 'Full', percentage: 100, amount: 1000, position: 0 },
        ],
      },
      departmentSections: {
        create: [{ departmentId: deptA }, { departmentId: deptB }],
      },
      items: {
        create: [
          {
            departmentId: deptA,
            description: 'Priced',
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
            position: 0,
          },
        ],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);

  await assert.rejects(
    () => service.submit(quote.id, {} as SubmitQuoteDto, undefined),
    /not yet priced/i,
    'submit rejects when a department section has zero subtotal',
  );
});

test('DM-9: submit() rejects a quote with no payment milestones', async () => {
  const clientId = await seedClient();
  const [departmentId] = await departmentIds();

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-NOMILE`,
      clientId,
      title: 'No milestones',
      status: QuoteStatus.DRAFT,
      subtotal: 1000,
      totalAmount: 1000,
      items: {
        create: [
          {
            departmentId,
            description: 'Priced',
            quantity: 1,
            unitPrice: 1000,
            subtotal: 1000,
            position: 0,
          },
        ],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);

  await assert.rejects(
    () => service.submit(quote.id, {} as SubmitQuoteDto, undefined),
    /payment milestone/i,
    'submit rejects when there are no payment milestones',
  );
});
