import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';

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
const audit = { log: async () => undefined } as unknown as AuditService;
const service = new QuotesService(prisma, notifications, pricingPolicy, audit);

const TAG = `TEST-DOC2-${Date.now()}`;
const trash = { quoteIds: [] as string[], clientIds: [] as string[] };

// RVd-2 made send() refuse a placeholder CompanyProfile. This DOC-2 manifest
// test must therefore send through a VALID active profile; snapshot the seeded
// bank details, swap in real-looking values for the duration of the test, and
// restore them afterwards so the dev DB returns to its seeded placeholder state.
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

  // RVd-2: send() now requires a non-placeholder active CompanyProfile. Swap the
  // seeded placeholder bank details for valid ones (restored in after()).
  const active = await prisma.companyProfile.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, iban: true, bankName: true },
  });
  assert.ok(active, 'an active CompanyProfile is seeded');
  savedBank = active;
  await prisma.companyProfile.update({
    where: { id: active.id },
    data: { iban: 'SA0380000000608010167519', bankName: 'Al Rajhi Bank' },
  });

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
