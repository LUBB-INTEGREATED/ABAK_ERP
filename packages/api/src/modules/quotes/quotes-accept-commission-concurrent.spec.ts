import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus, RfqStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';

// A-24 (P2 — real money bug). accept() accrues a broker commission once per RFQ
// with a check-then-insert guard (findFirst -> if (!existing) create) inside a
// READ COMMITTED $transaction. With no DB-level uniqueness, two CONCURRENT
// accept() calls on the same RFQ could both read "no existing row" and both
// INSERT, double-accruing a real payout. The fix is a partial unique index
// `commissions_rfqId_broker_unique` (rfqId WHERE beneficiaryType='BROKER') plus
// an idempotent P2002 catch in the accrual. This proves that firing two
// accept()s concurrently yields EXACTLY ONE commission row. Live dev Postgres.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const service = new QuotesService(prisma, notifications, pricingPolicy);

const TAG = `A24-${Date.now()}`;
const trash = {
  rfqIds: [] as string[],
  quoteIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
};

after(async () => {
  for (const id of trash.rfqIds) {
    await prisma.commission.deleteMany({ where: { rfqId: id } });
    await prisma.rfq.deleteMany({ where: { id } });
  }
  for (const id of trash.quoteIds) {
    await prisma.commercialConfirmation.deleteMany({ where: { quoteId: id } });
    await prisma.quote.deleteMany({ where: { id } });
  }
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

async function seedBrokerRfqQuote() {
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Concurrent Commission',
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
  const TOTAL = 250000;
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: client.id,
      title: 'Concurrent broker deal',
      status: QuoteStatus.SENT,
      subtotal: TOTAL,
      totalAmount: TOTAL,
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}-${trash.rfqIds.length}`,
      opportunityId: opp.id,
      clientId: client.id,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'BROKER',
      brokerName: 'Broker Concurrent',
      brokerPhone: '0590000000',
      status: RfqStatus.PRICING,
      quoteId: quote.id,
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);
  return { quoteId: quote.id, rfqId: rfq.id, total: TOTAL };
}

test('A-24: two concurrent accept() calls accrue EXACTLY ONE broker commission', async () => {
  const { quoteId, rfqId } = await seedBrokerRfqQuote();

  // Fire both accept()s on the same RFQ/quote concurrently. At most one should
  // win the WON transition + accrual; the loser must either no-op on the
  // once-guard or be rejected (e.g. the quote is no longer SENT) — never a
  // second commission. We tolerate one settled rejection; we do NOT tolerate a
  // second commission row.
  const results = await Promise.allSettled([
    service.accept(quoteId, {}, undefined, undefined),
    service.accept(quoteId, {}, undefined, undefined),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
  assert.ok(fulfilled >= 1, 'at least one accept() must succeed (the winner)');

  const commissions = await prisma.commission.findMany({
    where: { rfqId },
  });
  assert.equal(
    commissions.length,
    1,
    `exactly ONE broker commission must exist after concurrent accepts (got ${commissions.length})`,
  );
  assert.equal(commissions[0].beneficiaryType, 'BROKER');
  assert.ok(commissions[0].amount > 0, 'the accrued commission is non-zero');
});

test('A-24: the partial unique index rejects a second auto-accrued broker row for the same RFQ', async () => {
  // Direct DB-level proof the constraint is live: a manual second BROKER insert
  // for an already-accrued RFQ must fail with the unique-violation (P2002).
  const { quoteId, rfqId } = await seedBrokerRfqQuote();
  await service.accept(quoteId, {}, undefined, undefined);

  const first = await prisma.commission.findMany({ where: { rfqId } });
  assert.equal(first.length, 1, 'the first accrual produced one row');

  await assert.rejects(
    () =>
      prisma.commission.create({
        data: {
          rfqId,
          beneficiaryType: 'BROKER',
          beneficiaryName: 'Duplicate Broker',
          baseAmount: 1,
          rate: 1,
          amount: 0.01,
          status: 'ACCRUING',
        },
      }),
    (err: unknown) =>
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2002',
    'a second BROKER commission for the same rfqId must violate the partial unique index',
  );

  const after = await prisma.commission.findMany({ where: { rfqId } });
  assert.equal(after.length, 1, 'still exactly one broker commission');
});
