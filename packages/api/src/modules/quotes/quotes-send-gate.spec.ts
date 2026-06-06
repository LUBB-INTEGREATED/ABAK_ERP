import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';

// RVd-2 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). send() must refuse to ship an offer while the active
// CompanyProfile carries placeholder bank details (the seeded fake IBAN
// 'SA0000…' + 'TODO …' bank name) — and must succeed once real details exist.

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

const TAG = `TEST-RVD2-${Date.now()}`;
const trash = { quoteIds: [] as string[], clientIds: [] as string[] };
let savedBank:
  | { id: string; iban: string | null; bankName: string | null }
  | undefined;

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  if (savedBank) {
    await prisma.companyProfile.update({
      where: { id: savedBank.id },
      data: { iban: savedBank.iban, bankName: savedBank.bankName },
    });
  }
  await prisma.$disconnect();
});

async function makeApprovedQuote(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'RVd-2 Send-gate Test',
      phone: '0500000002',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const q = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'RVd-2 send gate',
      status: QuoteStatus.APPROVED,
      subtotal: 1000,
      totalAmount: 1000,
    },
    select: { id: true },
  });
  trash.quoteIds.push(q.id);
  return q.id;
}

test('RVd-2: send() is REJECTED while the active CompanyProfile has placeholder bank details', async () => {
  // Force the active profile back to the seeded placeholder state for this case.
  const active = await prisma.companyProfile.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, iban: true, bankName: true },
  });
  assert.ok(active, 'an active CompanyProfile is seeded');
  savedBank = active; // snapshot once for restoration in after()
  await prisma.companyProfile.update({
    where: { id: active.id },
    data: {
      iban: 'SA0000000000000000000000',
      bankName: 'TODO — set via Company Profile settings',
    },
  });

  const quoteId = await makeApprovedQuote();
  await assert.rejects(
    () => service.send(quoteId),
    /Bank details not configured/,
    'send rejected with placeholder IBAN + TODO bank name',
  );

  // The quote must remain APPROVED (not flipped to SENT) after the rejection.
  const after1 = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, sentAt: true },
  });
  assert.equal(after1?.status, QuoteStatus.APPROVED, 'still APPROVED');
  assert.equal(after1?.sentAt, null, 'not marked sent');
});

test('RVd-2: send() SUCCEEDS once real bank details are configured', async () => {
  // savedBank captured above; install valid details for this case.
  const active = await prisma.companyProfile.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  assert.ok(active, 'active profile present');
  await prisma.companyProfile.update({
    where: { id: active.id },
    data: { iban: 'SA0380000000608010167519', bankName: 'Al Rajhi Bank' },
  });

  const quoteId = await makeApprovedQuote();
  const sent = await service.send(quoteId);
  assert.equal(sent.status, QuoteStatus.SENT, 'quote is SENT');
  assert.ok(sent.sentAt, 'sentAt stamped');
});
