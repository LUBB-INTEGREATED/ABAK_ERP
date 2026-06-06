import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus, RfqStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';

// RV-9 regression: a broker commission accrued on accept() must be non-zero
// (base = contract value, amount = base * rate%) and once-per-RFQ.

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

const TAG = `RV9-${Date.now()}`;
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

async function brokerRate(): Promise<number> {
  const s = await prisma.systemSetting.findUnique({
    where: { key: 'commission_rate_broker_default' },
  });
  return s ? Number(s.value) : 3;
}

test('RV-9: accept() accrues a non-zero broker commission, once per RFQ', async () => {
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}`,
      contactName: 'Commission Test',
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
  const TOTAL = 100000;
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}`,
      clientId: client.id,
      title: 'Broker deal',
      status: QuoteStatus.SENT,
      subtotal: TOTAL,
      totalAmount: TOTAL,
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
      requestedByChannel: 'BROKER',
      brokerName: 'Broker X',
      brokerPhone: '0590000000',
      status: RfqStatus.PRICING,
      quoteId: quote.id,
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);

  const rate = await brokerRate();
  await service.accept(quote.id, {}, undefined, undefined);

  const commissions = await prisma.commission.findMany({
    where: { rfqId: rfq.id },
  });
  assert.equal(commissions.length, 1, 'exactly one commission accrued');
  const c = commissions[0];
  assert.equal(c.baseAmount, TOTAL, 'baseAmount = contract value');
  assert.equal(c.rate, rate, 'rate from commission_rate_broker_default');
  assert.equal(
    c.amount,
    Math.round(TOTAL * rate) / 100,
    'amount = base * rate%',
  );
  assert.ok(c.amount > 0, 'commission amount is non-zero');
});
