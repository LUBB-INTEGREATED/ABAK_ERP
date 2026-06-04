import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { QuoteSectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { RfqsService } from '../rfqs/rfqs.service';
import { RfqAssignmentsService } from '../rfqs/rfq-assignments.service';

// DM-15c regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). Exercises the §14 lead-reviewer section lifecycle end to end:
// startPricing seeds section pricer/lead from the assignments; the
// assignment→section mirror re-points after pricing; a pricer submits their
// section to the lead; the lead requests a revision; the compile view resolves
// pricers + items.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;

const quotes = new QuotesService(prisma, notifications, pricingPolicy);
const rfqs = new RfqsService(prisma, notifications);
const assignments = new RfqAssignmentsService(prisma, rfqs);

const TAG = `TEST-DM15C-${Date.now()}`;
const trash = {
  userIds: [] as string[],
  rfqIds: [] as string[],
  quoteIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
};

async function twoCategories(): Promise<[string, string]> {
  const cats = await prisma.serviceCategory.findMany({
    select: { id: true },
    take: 2,
  });
  if (cats.length < 2) throw new Error('need two ServiceCategory rows');
  return [cats[0].id, cats[1].id];
}

async function seedUser(label: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}-${label}-${trash.userIds.length}@example.com`,
      password: 'x',
      firstName: label,
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  trash.userIds.push(u.id);
  return u.id;
}

/**
 * Seed an RFQ routed to two departments, assign a lead pricer (catA) + a
 * co-pricer (catB), then startPricing to mint the linked Draft Quote with two
 * sections. Returns the wired ids.
 */
async function seedPricingQuote() {
  const [catA, catB] = await twoCategories();
  const engA = await seedUser('lead');
  const engB = await seedUser('co');

  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Section Lifecycle Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const opp = await prisma.pipelineEntry.create({
    data: { clientId: c.id },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}-${trash.rfqIds.length}`,
      opportunityId: opp.id,
      clientId: c.id,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: 'ASSIGNED',
      requestedCategoryIds: [catA, catB],
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);

  // catA assigned first → auto-lead; catB → co-pricer.
  await assignments.createAssignment(rfq.id, {
    departmentId: catA,
    assigneeId: engA,
  });
  await assignments.createAssignment(rfq.id, {
    departmentId: catB,
    assigneeId: engB,
  });

  const { quoteId } = await rfqs.startPricing(rfq.id, engA);
  trash.quoteIds.push(quoteId);

  const sections = await prisma.quoteDepartmentSection.findMany({
    where: { quoteId },
    select: {
      id: true,
      departmentId: true,
      pricerId: true,
      isLead: true,
      status: true,
    },
  });
  const secA = sections.find((s) => s.departmentId === catA)!;
  const secB = sections.find((s) => s.departmentId === catB)!;
  return { rfqId: rfq.id, quoteId, catA, catB, engA, engB, secA, secB };
}

async function priceSection(
  quoteId: string,
  sectionId: string,
  departmentId: string,
  amount = 1000,
) {
  await prisma.quoteItem.create({
    data: {
      quoteId,
      sectionId,
      departmentId,
      description: 'Priced line',
      quantity: 1,
      unitPrice: amount,
      subtotal: amount,
      position: 0,
    },
  });
}

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.rfqIds)
    await prisma.rfqAssignment.deleteMany({ where: { rfqId: id } });
  for (const id of trash.rfqIds) await prisma.rfq.deleteMany({ where: { id } });
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DM-15c: startPricing seeds section pricerId + isLead from the assignments', async () => {
  const w = await seedPricingQuote();
  assert.equal(w.secA.pricerId, w.engA, 'lead section pricer = catA assignee');
  assert.equal(w.secA.isLead, true, 'catA is the lead section');
  assert.equal(w.secB.pricerId, w.engB, 'co section pricer = catB assignee');
  assert.equal(w.secB.isLead, false, 'catB is not lead');
  assert.equal(w.secA.status, QuoteSectionStatus.DRAFT, 'sections start DRAFT');
});

test('DM-15c: re-assigning after pricing re-points the section pricer + moves the lead', async () => {
  const w = await seedPricingQuote();
  const engC = await seedUser('replacement');

  // Find catB's assignment and re-point it to engC + make it the lead.
  const list = await assignments.listAssignments(w.rfqId);
  const bAssign = list.find((a) => a.departmentId === w.catB)!;
  await assignments.updateAssignment(w.rfqId, bAssign.id, {
    assigneeId: engC,
    isLeadPricer: true,
  });

  const secs = await prisma.quoteDepartmentSection.findMany({
    where: { quoteId: w.quoteId },
    select: { departmentId: true, pricerId: true, isLead: true },
  });
  const a = secs.find((s) => s.departmentId === w.catA)!;
  const b = secs.find((s) => s.departmentId === w.catB)!;
  assert.equal(b.pricerId, engC, 'section catB re-pointed to the new pricer');
  assert.equal(b.isLead, true, 'lead moved to catB');
  assert.equal(a.isLead, false, 'previous lead catA cleared (single lead)');
});

test('DM-15c: a pricer submits their priced section to the lead (DRAFT → SUBMITTED_TO_LEAD)', async () => {
  const w = await seedPricingQuote();
  await priceSection(w.quoteId, w.secA.id, w.catA);

  const updated = await quotes.submitSection(w.quoteId, w.secA.id, {
    user: { id: w.engA },
  });
  assert.equal(updated.status, QuoteSectionStatus.SUBMITTED_TO_LEAD);
});

test('DM-15c: submitSection guards — wrong pricer, unpriced, and non-DRAFT', async () => {
  const w = await seedPricingQuote();
  await priceSection(w.quoteId, w.secA.id, w.catA);

  // wrong pricer (engB submitting catA)
  await assert.rejects(
    () => quotes.submitSection(w.quoteId, w.secA.id, { user: { id: w.engB } }),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-pricer cannot submit the section',
  );
  // unpriced section (catB has no items)
  await assert.rejects(
    () => quotes.submitSection(w.quoteId, w.secB.id, { user: { id: w.engB } }),
    /price the section/i,
    'an unpriced section is rejected',
  );
  // non-DRAFT (submit catA, then submit again)
  await quotes.submitSection(w.quoteId, w.secA.id, { user: { id: w.engA } });
  await assert.rejects(
    () => quotes.submitSection(w.quoteId, w.secA.id, { user: { id: w.engA } }),
    /DRAFT/,
    'a section already submitted cannot be re-submitted',
  );
});

test('DM-15c: only the lead can request a section revision (SUBMITTED_TO_LEAD → DRAFT)', async () => {
  const w = await seedPricingQuote();
  // Put catB into SUBMITTED_TO_LEAD directly.
  await prisma.quoteDepartmentSection.update({
    where: { id: w.secB.id },
    data: { status: QuoteSectionStatus.SUBMITTED_TO_LEAD },
  });

  // A non-lead caller (the co-pricer engB) is refused.
  await assert.rejects(
    () =>
      quotes.requestSectionRevision(w.quoteId, w.secB.id, 'fix scope', {
        user: { id: w.engB },
      }),
    (e: unknown) => e instanceof ForbiddenException,
    'a co-pricer cannot request a revision',
  );

  // The lead (engA) sends it back to DRAFT.
  const back = await quotes.requestSectionRevision(
    w.quoteId,
    w.secB.id,
    'please add the soil-report assumption',
    { user: { id: w.engA } },
  );
  assert.equal(back.status, QuoteSectionStatus.DRAFT);

  // The note + REVISION_REQUESTED landed on the linked assignment (no migration).
  const bAssign = await prisma.rfqAssignment.findFirst({
    where: { rfqId: w.rfqId, departmentId: w.catB },
    select: { status: true, notes: true },
  });
  assert.equal(bAssign?.status, 'REVISION_REQUESTED');
  assert.match(bAssign?.notes ?? '', /soil-report/);
});

test('DM-15c: listSections returns sections with resolved pricer + items', async () => {
  const w = await seedPricingQuote();
  await priceSection(w.quoteId, w.secA.id, w.catA, 1500);

  const sections = await quotes.listSections(w.quoteId, undefined);
  assert.equal(sections.length, 2, 'both sections returned');
  assert.equal(sections[0].isLead, true, 'lead section comes first');
  const a = sections.find((s) => s.departmentId === w.catA)!;
  assert.equal(a.pricer?.id, w.engA, 'pricer user resolved from pricerId');
  assert.equal(a.items.length, 1, 'section line items included');
  assert.equal(a.items[0].subtotal, 1500);
});

async function seedBareQuote(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Bare quote',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const q = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'Bare',
      status: 'DRAFT',
    },
    select: { id: true },
  });
  trash.quoteIds.push(q.id);
  return q.id;
}

test('RV3-3: an unassigned (null-pricer) section cannot be submitted by an arbitrary user', async () => {
  const quoteId = await seedBareQuote();
  const [catA] = await twoCategories();
  const section = await prisma.quoteDepartmentSection.create({
    data: { quoteId, departmentId: catA }, // pricerId null, DRAFT, not lead
    select: { id: true },
  });
  const intruder = await seedUser('intruder');
  await assert.rejects(
    () => quotes.submitSection(quoteId, section.id, { user: { id: intruder } }),
    (e: unknown) => e instanceof ForbiddenException,
    'a null-pricer section is not submittable by a random quote:build holder',
  );
});

test('RV3-4: request-revision is refused when the quote has no lead section', async () => {
  const quoteId = await seedBareQuote();
  const [catA] = await twoCategories();
  const section = await prisma.quoteDepartmentSection.create({
    data: {
      quoteId,
      departmentId: catA,
      status: QuoteSectionStatus.SUBMITTED_TO_LEAD,
    }, // isLead false, pricerId null
    select: { id: true },
  });
  const intruder = await seedUser('intruder2');
  await assert.rejects(
    () =>
      quotes.requestSectionRevision(quoteId, section.id, 'redo', {
        user: { id: intruder },
      }),
    (e: unknown) => e instanceof ForbiddenException,
    'no lead section → nobody can request a revision (fail closed)',
  );
});

test('RV3-5: assigning a department absent from the quote keeps the existing lead', async () => {
  const cats = await prisma.serviceCategory.findMany({
    select: { id: true },
    take: 3,
  });
  if (cats.length < 3) return; // needs a third, unrouted category
  const w = await seedPricingQuote(); // lead on catA, co on catB
  const thirdCat = cats.find((c) => c.id !== w.catA && c.id !== w.catB)!.id;
  const engX = await seedUser('thirdDept');

  // Assign a department that is NOT one of the quote's sections, as lead.
  await assignments.createAssignment(w.rfqId, {
    departmentId: thirdCat,
    assigneeId: engX,
    isLeadPricer: true,
  });

  const leads = await prisma.quoteDepartmentSection.findMany({
    where: { quoteId: w.quoteId, isLead: true },
    select: { departmentId: true },
  });
  assert.equal(leads.length, 1, 'still exactly one lead section');
  assert.equal(leads[0].departmentId, w.catA, 'the original lead is untouched');
});
