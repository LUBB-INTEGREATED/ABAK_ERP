import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { QuoteRequirementType, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';

// DM-15d regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). Requirement CRUD + the lead-reviewer dedup (merge duplicate
// per-department lines into one shared row, recording dedupedFromIds).

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const service = new QuotesService(prisma, notifications, pricingPolicy);

const TAG = `TEST-DM15D-${Date.now()}`;
const trash = {
  quoteIds: [] as string[],
  clientIds: [] as string[],
  userIds: [] as string[],
};

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

async function seedQuote(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Requirements Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const q = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'Requirements',
      status: QuoteStatus.DRAFT,
    },
    select: { id: true },
  });
  trash.quoteIds.push(q.id);
  return q.id;
}

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DM-15d: add / edit / delete a requirement (auto-incrementing position)', async () => {
  const quoteId = await seedQuote();

  const r1 = await service.addRequirement(quoteId, {
    type: QuoteRequirementType.DOCUMENT,
    text: 'Client must provide CR',
  });
  assert.equal(r1.position, 0, 'first requirement is position 0');
  assert.equal(r1.type, QuoteRequirementType.DOCUMENT);

  const r2 = await service.addRequirement(quoteId, { text: 'Soil report' });
  assert.equal(r2.position, 1, 'position auto-increments');
  assert.equal(r2.type, QuoteRequirementType.NOTE, 'defaults to NOTE');

  const edited = await service.updateRequirement(quoteId, r1.id, {
    text: 'Client must provide the commercial registration (CR)',
  });
  assert.match(edited.text, /commercial registration/);

  const del = await service.deleteRequirement(quoteId, r2.id);
  assert.match(del.message, /deleted/i);
  const remaining = await prisma.quoteRequirement.findMany({
    where: { quoteId },
  });
  assert.equal(remaining.length, 1, 'only the kept requirement remains');
});

test('DM-15d: lead dedup merges duplicates into one shared row', async () => {
  const quoteId = await seedQuote();
  const lead = await seedUser('lead');
  await prisma.quoteDepartmentSection.create({
    data: {
      quoteId,
      departmentId: (await prisma.serviceCategory.findFirstOrThrow()).id,
      isLead: true,
      pricerId: lead,
    },
  });

  const keep = await service.addRequirement(quoteId, { text: 'CR copy' });
  const dupA = await service.addRequirement(quoteId, { text: 'CR (copy)' });
  const dupB = await service.addRequirement(quoteId, { text: 'CR document' });

  const merged = await service.dedupRequirements(
    quoteId,
    keep.id,
    [dupA.id, dupB.id],
    { user: { id: lead } },
  );
  assert.equal(merged.isShared, true, 'kept row is flagged shared');
  assert.deepEqual(
    [...merged.dedupedFromIds].sort(),
    [dupA.id, dupB.id].sort(),
    'kept row records the merged source ids',
  );
  const survivors = await prisma.quoteRequirement.findMany({
    where: { quoteId },
    select: { id: true },
  });
  assert.deepEqual(
    survivors.map((s) => s.id),
    [keep.id],
    'the merged rows are deleted; only the shared row survives',
  );
});

test('DM-15d: only the lead reviewer can dedup', async () => {
  const quoteId = await seedQuote();
  const lead = await seedUser('lead');
  const other = await seedUser('other');
  await prisma.quoteDepartmentSection.create({
    data: {
      quoteId,
      departmentId: (await prisma.serviceCategory.findFirstOrThrow()).id,
      isLead: true,
      pricerId: lead,
    },
  });
  const keep = await service.addRequirement(quoteId, { text: 'A' });
  const dup = await service.addRequirement(quoteId, { text: 'A dup' });

  await assert.rejects(
    () =>
      service.dedupRequirements(quoteId, keep.id, [dup.id], {
        user: { id: other },
      }),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-lead caller cannot dedup',
  );
});

test('RV3-6: dedup is refused when the quote has no lead section', async () => {
  const quoteId = await seedQuote(); // no department sections at all
  const intruder = await seedUser('intruder');
  const keep = await service.addRequirement(quoteId, { text: 'A' });
  const dup = await service.addRequirement(quoteId, { text: 'A dup' });

  await assert.rejects(
    () =>
      service.dedupRequirements(quoteId, keep.id, [dup.id], {
        user: { id: intruder },
      }),
    (e: unknown) => e instanceof ForbiddenException,
    'no lead section → dedup is refused (fail closed)',
  );
});

test('DM-15d: dedup rejects merge ids not on the quote / empty merge set', async () => {
  const quoteId = await seedQuote();
  const keep = await service.addRequirement(quoteId, { text: 'Keep' });

  await assert.rejects(
    () => service.dedupRequirements(quoteId, keep.id, [keep.id], undefined),
    /no distinct requirements/i,
    'merging only the kept id is rejected',
  );
  await assert.rejects(
    () =>
      service.dedupRequirements(quoteId, keep.id, ['not-a-real-id'], undefined),
    /not found on this quote/i,
    'a foreign merge id is rejected',
  );
});
