import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus, RfqStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RfqsService } from './rfqs.service';

// RV-5 regression: concurrent startPricing must yield exactly one quote and no
// orphaned draft. Runs against the live dev Postgres (READ COMMITTED).

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const service = new RfqsService(prisma, notifications);

const TAG = `RV5-${Date.now()}`;
const trash = {
  rfqIds: [] as string[],
  quoteIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
};

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

async function seedRfq(): Promise<{ id: string; rfqNumber: string }> {
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'StartPricing Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);
  const dept = await prisma.serviceCategory.findFirst({ select: { id: true } });
  if (!dept) throw new Error('no ServiceCategory to use as a department');
  const opp = await prisma.pipelineEntry.create({
    data: { clientId: client.id },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}-${trash.rfqIds.length}`,
      opportunityId: opp.id,
      clientId: client.id,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: RfqStatus.SUBMITTED,
      requestedCategoryIds: [dept.id],
    },
    select: { id: true, rfqNumber: true },
  });
  trash.rfqIds.push(rfq.id);
  return rfq;
}

async function aUserId(): Promise<string> {
  const u = await prisma.user.findFirst({ select: { id: true } });
  if (!u) throw new Error('no User to use as actor');
  return u.id;
}

test('RV-5: concurrent startPricing → exactly one quote, zero orphans', async () => {
  const rfq = await seedRfq();
  const actorId = await aUserId();

  const [a, b] = await Promise.all([
    service.startPricing(rfq.id, actorId, undefined),
    service.startPricing(rfq.id, actorId, undefined),
  ]);
  trash.quoteIds.push(a.quoteId, b.quoteId);

  assert.equal(a.quoteId, b.quoteId, 'both calls resolve to the same quote');

  const afterRfq = await prisma.rfq.findUnique({
    where: { id: rfq.id },
    select: { quoteId: true, status: true },
  });
  assert.equal(afterRfq?.quoteId, a.quoteId, 'rfq linked to the winner');
  assert.equal(afterRfq?.status, RfqStatus.PRICING);

  // The loser's just-created quote was rolled back: exactly one quote carries
  // this RFQ's generated title.
  const n = await prisma.quote.count({
    where: { title: `عرض سعر — ${rfq.rfqNumber}` },
  });
  assert.equal(n, 1, 'exactly one quote — no orphan');
});

test('RV-5: idempotent re-call returns the same quote', async () => {
  const rfq = await seedRfq();
  const actorId = await aUserId();
  const first = await service.startPricing(rfq.id, actorId, undefined);
  const second = await service.startPricing(rfq.id, actorId, undefined);
  trash.quoteIds.push(first.quoteId);
  assert.equal(
    second.quoteId,
    first.quoteId,
    'second call returns the same quote',
  );
});

test('RV-7: cancel() is rejected once the linked quote is WON', async () => {
  const rfq = await seedRfq(); // SUBMITTED
  const client = await prisma.rfq.findUnique({
    where: { id: rfq.id },
    select: { clientId: true },
  });
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-WON-${trash.quoteIds.length}`,
      clientId: client!.clientId,
      title: 'Won quote',
      status: QuoteStatus.WON,
      subtotal: 1000,
      totalAmount: 1000,
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  // thin model: rfq stays PRICING + links the (now WON) quote
  await prisma.rfq.update({
    where: { id: rfq.id },
    data: { quoteId: quote.id, status: RfqStatus.PRICING },
  });

  await assert.rejects(
    () => service.cancel(rfq.id, undefined),
    /advanced past pricing/i,
    'cancel rejected on a WON-linked RFQ',
  );
});

test('RV-7: cancel() still works on a pre-pricing RFQ', async () => {
  const rfq = await seedRfq(); // SUBMITTED, no quote
  const cancelled = await service.cancel(rfq.id, undefined);
  assert.equal(cancelled.status, RfqStatus.CANCELLED);
});
