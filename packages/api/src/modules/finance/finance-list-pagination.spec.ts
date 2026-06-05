import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ConfirmationType, PaymentValidationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from './finance.service';

// A-18 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). listCommercialConfirmations / listCommissions used to findMany
// the entire (only-growing) table with joins on every call — no skip/take.
// These tests assert the endpoints now accept page/pageSize and bound the take
// so an unfiltered call can't stream the whole table. The @Max(100) cap is
// declared on the DTO and enforced by the global ValidationPipe.

const prisma = new PrismaService();
const audit = { log: async () => undefined } as unknown as AuditService;
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const service = new FinanceService(prisma, audit, notifications);

const TAG = `TEST-A18-${Date.now()}`;
const trash = {
  confirmationIds: [] as string[],
  quoteIds: [] as string[],
  clientIds: [] as string[],
};

async function seedConfirmation() {
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Finance Page Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: client.id,
      title: 'Finance page',
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  const conf = await prisma.commercialConfirmation.create({
    data: {
      quoteId: quote.id,
      type: ConfirmationType.PAYMENT,
      contractValue: 1000,
      validationStatus: PaymentValidationStatus.PENDING,
    },
    select: { id: true },
  });
  trash.confirmationIds.push(conf.id);
  return conf.id;
}

after(async () => {
  for (const id of trash.confirmationIds)
    await prisma.commercialConfirmation.deleteMany({ where: { id } });
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('A-18: listCommercialConfirmations bounds the result by pageSize', async () => {
  await seedConfirmation();
  await seedConfirmation();
  await seedConfirmation();

  const pageOne = await service.listCommercialConfirmations({
    status: PaymentValidationStatus.PENDING,
    page: 1,
    pageSize: 2,
  });
  assert.ok(Array.isArray(pageOne), 'returns an array');
  assert.equal(pageOne.length, 2, 'pageSize=2 caps the take to 2 rows');

  const pageTwo = await service.listCommercialConfirmations({
    status: PaymentValidationStatus.PENDING,
    page: 2,
    pageSize: 2,
  });
  // The three seeded rows span two pages; page 2 must not repeat page-1 ids.
  const idsOne = new Set((pageOne as { id: string }[]).map((r) => r.id));
  const idsTwo = (pageTwo as { id: string }[]).map((r) => r.id);
  assert.ok(
    idsTwo.every((id) => !idsOne.has(id)),
    'page 2 returns distinct rows from page 1 (skip applied)',
  );
});

test('A-18: listCommissions accepts page/pageSize and returns a bounded array', async () => {
  // No commissions are seeded (the chain is heavy); the contract assertion is
  // that the call accepts pagination params and returns a bounded array, not
  // the whole table.
  const res = await service.listCommissions({ page: 1, pageSize: 5 });
  assert.ok(Array.isArray(res), 'returns an array');
  assert.ok(res.length <= 5, 'pageSize caps the take');
});
