import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';
import type { UpdateQuoteDto } from './dto';

// RV3b-2 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). The QP-5 read-scope broadening admits any section pricer to READ
// a quote; this asserts WHOLE-quote writes (update / softDelete) stay restricted
// to the preparer or the lead-section pricer — a co-pricer can't clobber the
// shared draft.

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

const TAG = `TEST-RV3B2-${Date.now()}`;
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

async function twoCategories(): Promise<[string, string]> {
  const cats = await prisma.serviceCategory.findMany({
    select: { id: true },
    take: 2,
  });
  if (cats.length < 2) throw new Error('need two ServiceCategory rows');
  return [cats[0].id, cats[1].id];
}

async function seedQuote() {
  const [catA, catB] = await twoCategories();
  const preparer = await seedUser('preparer');
  const leadPricer = await seedUser('lead');
  const coPricer = await seedUser('co');
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Write Scope Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'Write scope',
      status: QuoteStatus.DRAFT,
      preparedById: preparer,
      departmentSections: {
        create: [
          { departmentId: catA, isLead: true, pricerId: leadPricer },
          { departmentId: catB, isLead: false, pricerId: coPricer },
        ],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  return { quoteId: quote.id, preparer, leadPricer, coPricer };
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

test('RV3b-2: a co-pricer cannot update the whole quote', async () => {
  const w = await seedQuote();
  const ctx = { user: { id: w.coPricer }, scope: 'DEPARTMENT' as const };
  await assert.rejects(
    () =>
      service.update(w.quoteId, { title: 'hijacked' } as UpdateQuoteDto, ctx),
    (e: unknown) => e instanceof ForbiddenException,
    'a co-pricer must not rewrite the shared quote',
  );
});

test('RV3b-2: a co-pricer cannot soft-delete the quote', async () => {
  const w = await seedQuote();
  const ctx = { user: { id: w.coPricer }, scope: 'DEPARTMENT' as const };
  await assert.rejects(
    () => service.softDelete(w.quoteId, ctx),
    (e: unknown) => e instanceof ForbiddenException,
    'a co-pricer must not delete the shared draft',
  );
});

test('RV3b-2: the lead pricer and the preparer can update', async () => {
  const w = await seedQuote();
  const leadCtx = { user: { id: w.leadPricer }, scope: 'DEPARTMENT' as const };
  const prepCtx = { user: { id: w.preparer }, scope: 'OWN' as const };
  // Neither should throw Forbidden (they proceed through the authz gate).
  const asLead = await service.update(
    w.quoteId,
    { title: 'lead-edit' } as UpdateQuoteDto,
    leadCtx,
  );
  assert.equal(asLead.title, 'lead-edit', 'lead pricer can update');
  const asPrep = await service.update(
    w.quoteId,
    { title: 'prep-edit' } as UpdateQuoteDto,
    prepCtx,
  );
  assert.equal(asPrep.title, 'prep-edit', 'preparer can update');
});
