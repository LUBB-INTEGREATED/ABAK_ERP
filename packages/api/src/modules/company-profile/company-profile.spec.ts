import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from '../auth/permissions.service';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from '../quotes/quotes.service';
import { CompanyProfileController } from './company-profile.controller';
import { CompanyProfileService } from './company-profile.service';

// CompanyProfile settings endpoint regression. Runs against the live dev
// Postgres (DATABASE_URL via --env-file). Covers:
//   (a) a company_profile.manage holder PATCH updates the profile + writes a
//       per-field CompanyProfileHistory row,
//   (b) a non-holder is refused by the PermissionGuard (403 path),
//   (c) an invalid IBAN (SA0000… / wrong length) is rejected (400),
//   (d) once VALID bank details are set, the previously-blocked quote send()
//       succeeds (SENT) — the ship-dependency this endpoint unblocks.
// The seeded placeholder profile is snapshotted and restored in after().

const prisma = new PrismaService();
const service = new CompanyProfileService(prisma);

const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const pricingPolicy = {
  resolveApprovalChain: async () => [],
} as unknown as PricingPolicyService;
const quotes = new QuotesService(prisma, notifications, pricingPolicy);

const TAG = `TEST-CPROF-${Date.now()}`;
const trash = {
  quoteIds: [] as string[],
  clientIds: [] as string[],
  userIds: [] as string[],
  historyIds: [] as string[],
};
let savedProfile:
  | { id: string; iban: string | null; bankName: string | null }
  | undefined;

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  for (const id of trash.historyIds)
    await prisma.companyProfileHistory.deleteMany({ where: { id } });
  if (savedProfile) {
    await prisma.companyProfile.update({
      where: { id: savedProfile.id },
      data: { iban: savedProfile.iban, bankName: savedProfile.bankName },
    });
  }
  await prisma.$disconnect();
});

async function snapshotProfile(): Promise<void> {
  if (savedProfile) return;
  const active = await prisma.companyProfile.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, iban: true, bankName: true },
  });
  assert.ok(active, 'an active CompanyProfile is seeded');
  savedProfile = active;
}

async function makeApprovedQuote(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'CompanyProfile Test',
      phone: '0500000003',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const q = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'CompanyProfile send-now-works',
      status: QuoteStatus.APPROVED,
      subtotal: 1000,
      totalAmount: 1000,
    },
    select: { id: true },
  });
  trash.quoteIds.push(q.id);
  return q.id;
}

test('(a) a company_profile.manage holder PATCH updates the profile + writes a history row', async () => {
  await snapshotProfile();
  // Force a known placeholder starting state so the bank fields are a real change.
  await prisma.companyProfile.update({
    where: { id: savedProfile!.id },
    data: {
      iban: 'SA0000000000000000000000',
      bankName: 'TODO — set via Company Profile settings',
    },
  });

  const actorId = `${TAG}-actor`;
  const before = await prisma.companyProfileHistory.count({
    where: { profileId: savedProfile!.id },
  });

  const updated = await service.update(
    {
      legalName: 'ABAK Engineering Consultancy (verified)',
      bankName: 'Al Rajhi Bank',
      bankAccountName: 'ABAK Engineering Consultancy Co.',
      iban: 'SA0380000000608010167519',
    },
    actorId,
  );

  assert.equal(updated.bankName, 'Al Rajhi Bank', 'bank name persisted');
  assert.equal(
    updated.iban,
    'SA0380000000608010167519',
    'IBAN persisted (normalized)',
  );
  assert.equal(
    updated.legalName,
    'ABAK Engineering Consultancy (verified)',
    'non-bank field persisted',
  );

  const rows = await prisma.companyProfileHistory.findMany({
    where: { profileId: savedProfile!.id, changedById: actorId },
    orderBy: { changedAt: 'asc' },
  });
  for (const r of rows) trash.historyIds.push(r.id);
  const after = await prisma.companyProfileHistory.count({
    where: { profileId: savedProfile!.id },
  });
  assert.ok(after > before, 'history rows were appended');

  const byField = new Map(rows.map((r) => [r.field, r]));
  assert.ok(byField.has('iban'), 'iban change audited');
  assert.equal(
    byField.get('iban')?.oldValue,
    'SA0000000000000000000000',
    'old IBAN recorded',
  );
  assert.equal(
    byField.get('iban')?.newValue,
    'SA0380000000608010167519',
    'new IBAN recorded',
  );
  assert.ok(byField.has('bankName'), 'bankName change audited');
  // legalName is NOT bank-sensitive → must NOT be in the audit trail.
  assert.ok(!byField.has('legalName'), 'non-bank field is not audited');
});

test('(b) a non-holder is refused by the PermissionGuard (403 path)', async () => {
  // A real user with NO roles → holds no permissions, incl. company_profile.manage.
  const u = await prisma.user.create({
    data: {
      email: `${TAG}-nonholder@example.com`,
      password: 'x',
      firstName: 'Non',
      lastName: 'Holder',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  trash.userIds.push(u.id);

  const guard = new PermissionGuard(
    new Reflector(),
    new PermissionsService(prisma),
  );
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: u.id } }),
    }),
    getHandler: () => CompanyProfileController.prototype.patch,
    getClass: () => CompanyProfileController,
  } as unknown as Parameters<PermissionGuard['canActivate']>[0];

  await assert.rejects(
    () => guard.canActivate(ctx),
    /Missing required permission/i,
    'non-holder is forbidden on PATCH /company-profile',
  );
});

test('(c) an invalid IBAN is rejected (400)', async () => {
  await snapshotProfile();
  // All-zero placeholder.
  await assert.rejects(
    () => service.update({ iban: 'SA0000000000000000000000' }),
    /Invalid IBAN/i,
    'SA0000… placeholder rejected',
  );
  // Wrong length.
  await assert.rejects(
    () => service.update({ iban: 'SA123' }),
    /Invalid IBAN/i,
    'too-short IBAN rejected',
  );
  // Non-SA country.
  await assert.rejects(
    () => service.update({ iban: 'GB29NWBK60161331926819' }),
    /Invalid IBAN/i,
    'non-Saudi IBAN rejected',
  );
  // TODO bank-name sentinel.
  await assert.rejects(
    () => service.update({ bankName: 'TODO — set me' }),
    /Invalid bank name/i,
    'TODO bank-name sentinel rejected',
  );
});

test('(d) once valid bank details are set, the previously-blocked quote send() succeeds', async () => {
  await snapshotProfile();
  // Start from the blocked state: placeholder bank details → send() must reject.
  await prisma.companyProfile.update({
    where: { id: savedProfile!.id },
    data: {
      iban: 'SA0000000000000000000000',
      bankName: 'TODO — set via Company Profile settings',
    },
  });
  const blockedQuote = await makeApprovedQuote();
  await assert.rejects(
    () => quotes.send(blockedQuote),
    /Bank details not configured/i,
    'send() blocked while placeholder bank details remain',
  );

  // Configure real bank details THROUGH THE NEW ENDPOINT'S SERVICE.
  const updated = await service.update(
    { bankName: 'Al Rajhi Bank', iban: 'SA0380000000608010167519' },
    `${TAG}-actor-d`,
  );
  const rows = await prisma.companyProfileHistory.findMany({
    where: { profileId: savedProfile!.id, changedById: `${TAG}-actor-d` },
    select: { id: true },
  });
  for (const r of rows) trash.historyIds.push(r.id);
  assert.equal(updated.iban, 'SA0380000000608010167519', 'real IBAN set');

  // Now the gate is satisfied → a fresh APPROVED quote sends.
  const sendableQuote = await makeApprovedQuote();
  const sent = await quotes.send(sendableQuote);
  assert.equal(sent.status, QuoteStatus.SENT, 'quote is now SENT');
  assert.ok(sent.sentAt, 'sentAt stamped');
});
