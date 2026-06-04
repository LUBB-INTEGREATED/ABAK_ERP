import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';

// DOC-2 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). send() must snapshot the resolved template + company profile onto
// Quote.renderManifest so the quote renders as-issued later. Depends on the
// DOC-1 default template being seeded.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const service = new QuotesService(prisma, notifications, pricingPolicy);

const TAG = `TEST-DOC2-${Date.now()}`;
const trash = { quoteIds: [] as string[], clientIds: [] as string[] };

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DOC-2: send() snapshots the render manifest (template + company)', async () => {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}`,
      contactName: 'Manifest Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}`,
      clientId: c.id,
      title: 'Manifest snapshot',
      status: QuoteStatus.APPROVED,
      subtotal: 1000,
      totalAmount: 1000,
    },
    select: { id: true, renderManifest: true },
  });
  trash.quoteIds.push(quote.id);
  assert.equal(quote.renderManifest, null, 'no manifest before send');

  await service.send(quote.id);

  const sent = await prisma.quote.findUnique({
    where: { id: quote.id },
    select: { status: true, renderManifest: true },
  });
  assert.equal(sent?.status, QuoteStatus.SENT, 'quote is SENT');
  const m = sent?.renderManifest as {
    schema: number;
    templateId: string | null;
    sections: { sectionType: string }[];
    company: { legalName: string; bank: { iban: string | null } } | null;
  } | null;
  assert.ok(m, 'manifest snapshotted on send');
  assert.equal(m.schema, 1);
  assert.equal(m.sections.length, 8, 'all 8 template blocks captured');
  assert.ok(
    m.sections.some((s) => s.sectionType === 'SCOPE_PRICING'),
    'scope/pricing block present',
  );
  assert.ok(m.company?.legalName, 'company legal name captured');
  assert.ok(
    'iban' in (m.company?.bank ?? {}),
    'bank block captured (as-issued IBAN)',
  );
});
