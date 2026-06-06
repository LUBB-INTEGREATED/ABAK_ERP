import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { AuditService } from '../audit/audit.service';
import { QuotesService } from './quotes.service';

// CHAIN-2/3/4 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file).
//   CHAIN-2 — an assigned approval-chain member (neither preparer nor pricer)
//             can READ the quote; a random user still 403s.
//   CHAIN-3 — rejecting an approval without a reason is a 400; with a reason it
//             is recorded + audited.
//   CHAIN-4 — an approver can only decide their tier once all LOWER tiers are
//             APPROVED (no L2 before L1).

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

const TAG = `TEST-CHAIN234-${Date.now()}`;
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

/**
 * A quote with a preparer + a 2-tier pending approval chain (L1 approver, L2
 * approver). Neither approver is the preparer or a section pricer.
 */
async function seedQuoteWithChain() {
  const preparer = await seedUser('preparer');
  const l1 = await seedUser('l1approver');
  const l2 = await seedUser('l2approver');
  const stranger = await seedUser('stranger');
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Approval Access Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: c.id,
      title: 'Approval access',
      status: QuoteStatus.PENDING_APPROVAL,
      preparedById: preparer,
      approvals: {
        create: [
          { tier: 1, approverId: l1, status: ApprovalStatus.PENDING },
          { tier: 2, approverId: l2, status: ApprovalStatus.PENDING },
        ],
      },
    },
    include: { approvals: { orderBy: { tier: 'asc' } } },
  });
  trash.quoteIds.push(quote.id);
  return {
    quoteId: quote.id,
    preparer,
    l1,
    l2,
    stranger,
    l1ApprovalId: quote.approvals[0].id,
    l2ApprovalId: quote.approvals[1].id,
  };
}

after(async () => {
  for (const id of trash.quoteIds)
    await prisma.quoteApproval.deleteMany({ where: { quoteId: id } });
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('CHAIN-2: an assigned approver (not preparer/pricer) can read the quote', async () => {
  const w = await seedQuoteWithChain();
  const ctx = { user: { id: w.l1 }, scope: 'DEPARTMENT' as const };
  const quote = await service.findOne(w.quoteId, ctx);
  assert.equal(quote.id, w.quoteId, 'the L1 approver can open the quote');
});

test('CHAIN-2: a random user still 403s on the quote', async () => {
  const w = await seedQuoteWithChain();
  const ctx = { user: { id: w.stranger }, scope: 'OWN' as const };
  await assert.rejects(
    () => service.findOne(w.quoteId, ctx),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-chain user cannot open the quote',
  );
});

test('CHAIN-2: the approval-chain member also appears in the scoped list', async () => {
  const w = await seedQuoteWithChain();
  const ctx = { user: { id: w.l1 }, scope: 'DEPARTMENT' as const };
  const { data } = await service.findAll({}, ctx);
  assert.ok(
    data.some((q) => q.id === w.quoteId),
    'the L1 approver sees the quote in their scoped list',
  );
});

test('CHAIN-3: rejecting without a reason is a 400', async () => {
  const w = await seedQuoteWithChain();
  await assert.rejects(
    () =>
      service.decideApproval(
        w.quoteId,
        w.l1ApprovalId,
        { status: ApprovalStatus.REJECTED },
        w.l1,
      ),
    (e: unknown) =>
      e instanceof BadRequestException && /reason is required/i.test(e.message),
    'reject with no reason is refused',
  );
});

test('CHAIN-3: rejecting with a reason is recorded + audited', async () => {
  const w = await seedQuoteWithChain();
  const auditCalls: { action: string; reason: unknown }[] = [];
  const localAudit = {
    log: async (r: { action: string; newValues?: { reason?: unknown } }) => {
      auditCalls.push({ action: r.action, reason: r.newValues?.reason });
    },
  } as unknown as AuditService;
  const localService = new QuotesService(
    prisma,
    notifications,
    pricingPolicy,
    localAudit,
  );

  await localService.decideApproval(
    w.quoteId,
    w.l1ApprovalId,
    { status: ApprovalStatus.REJECTED, comments: 'Pricing too low' },
    w.l1,
  );

  const approval = await prisma.quoteApproval.findUnique({
    where: { id: w.l1ApprovalId },
    select: { status: true, comments: true },
  });
  assert.equal(approval?.status, ApprovalStatus.REJECTED, 'approval rejected');
  assert.equal(approval?.comments, 'Pricing too low', 'reason recorded');

  const q = await prisma.quote.findUnique({
    where: { id: w.quoteId },
    select: { status: true },
  });
  assert.equal(q?.status, QuoteStatus.DRAFT, 'rejected quote returns to DRAFT');

  assert.ok(
    auditCalls.some(
      (a) => a.action === 'QUOTE_APPROVAL_REJECTED' && a.reason === 'Pricing too low',
    ),
    'a rejection audit row with the reason is written',
  );
});

test('CHAIN-4: L2 cannot decide before L1 is approved', async () => {
  const w = await seedQuoteWithChain();
  await assert.rejects(
    () =>
      service.decideApproval(
        w.quoteId,
        w.l2ApprovalId,
        { status: ApprovalStatus.APPROVED },
        w.l2,
      ),
    (e: unknown) =>
      e instanceof BadRequestException &&
      /lower approval tiers must be approved first/i.test(e.message),
    'L2 is blocked until L1 is approved',
  );
});

test('CHAIN-4: L2 may decide once L1 is approved', async () => {
  const w = await seedQuoteWithChain();
  // L1 approves first.
  await service.decideApproval(
    w.quoteId,
    w.l1ApprovalId,
    { status: ApprovalStatus.APPROVED },
    w.l1,
  );
  // Now L2 may decide.
  await service.decideApproval(
    w.quoteId,
    w.l2ApprovalId,
    { status: ApprovalStatus.APPROVED },
    w.l2,
  );
  const q = await prisma.quote.findUnique({
    where: { id: w.quoteId },
    select: { status: true },
  });
  assert.equal(
    q?.status,
    QuoteStatus.APPROVED,
    'all tiers approved → quote APPROVED',
  );
});
