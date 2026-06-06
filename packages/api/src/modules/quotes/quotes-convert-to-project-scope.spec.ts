import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingPolicyService } from '../settings/pricing-policy.service';
import { QuotesService } from './quotes.service';
import { AuditService } from '../audit/audit.service';

// A-12 (SECURITY/IDOR) regression. Runs against the live dev Postgres
// (DATABASE_URL via --env-file). convertToProject auto-validates the commercial
// confirmation, mints the PO, and creates the Project + 7 default phases. Before
// the fix the controller forwarded NO scopeCtx and the service did a raw
// findUnique, so a non-ALL actor who neither prepared the quote nor leads a
// section could convert a quote outside their scope — minting a PO + Project
// they have no right to. These tests assert:
//   1. a non-owner non-ALL actor → 403,
//   2. the preparer (and ALL) succeed,
//   3. the happy path mints exactly ONE PO (contractValue == quote total) plus a
//      Project + 7 phases,
//   4. the conversion is idempotent (a second call does not double-mint).

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

const TAG = `A12-${Date.now()}`;
const trash = {
  phaseProjectIds: [] as string[],
  projectIds: [] as string[],
  poIds: [] as string[],
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

const TOTAL = 250000;

async function seedWonQuote() {
  const [catA, catB] = await twoCategories();
  const preparer = await seedUser('preparer');
  const leadPricer = await seedUser('lead');
  const outsider = await seedUser('outsider');
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Convert Scope Test',
      phone: '0500000000',
    },
    select: { id: true, lifetimeValue: true },
  });
  trash.clientIds.push(client.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: client.id,
      title: 'Convert scope',
      status: QuoteStatus.WON,
      subtotal: TOTAL,
      totalAmount: TOTAL,
      preparedById: preparer,
      departmentSections: {
        create: [
          { departmentId: catA, isLead: true, pricerId: leadPricer },
          { departmentId: catB, isLead: false, pricerId: outsider },
        ],
      },
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  return {
    quoteId: quote.id,
    clientId: client.id,
    preparer,
    leadPricer,
    outsider,
  };
}

// Track everything convertToProject mints so teardown is clean.
async function trackMinted(quoteId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { quoteId },
    include: { project: { select: { id: true } } },
  });
  if (po) {
    trash.poIds.push(po.id);
    if (po.project) {
      trash.projectIds.push(po.project.id);
      trash.phaseProjectIds.push(po.project.id);
    }
  }
}

after(async () => {
  for (const pid of trash.phaseProjectIds)
    await prisma.phase.deleteMany({ where: { projectId: pid } });
  for (const pid of trash.projectIds)
    await prisma.project.deleteMany({ where: { id: pid } });
  for (const id of trash.poIds)
    await prisma.purchaseOrder.deleteMany({ where: { id } });
  for (const id of trash.quoteIds) {
    await prisma.commercialConfirmation.deleteMany({ where: { quoteId: id } });
    await prisma.quote.deleteMany({ where: { id } });
  }
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('A-12: a non-owner non-ALL actor cannot convert a quote outside their scope (403)', async () => {
  const w = await seedWonQuote();
  // The outsider prices a NON-lead section, so the read-scope (findOne) admits
  // them but the write-scope (assertCanMutateQuote) must reject the conversion.
  const ctx = { user: { id: w.outsider }, scope: 'DEPARTMENT' as const };
  await assert.rejects(
    () => service.convertToProject(w.quoteId, {}, w.outsider, ctx),
    (e: unknown) => e instanceof ForbiddenException,
    'a co-pricer must not be able to mint a PO + Project from the shared quote',
  );
  await trackMinted(w.quoteId);

  // Nothing was minted.
  const po = await prisma.purchaseOrder.findUnique({
    where: { quoteId: w.quoteId },
  });
  assert.equal(po, null, 'no PO minted by the rejected conversion');
  const projects = await prisma.project.findMany({
    where: { po: { quoteId: w.quoteId } },
  });
  assert.equal(
    projects.length,
    0,
    'no Project minted by the rejected conversion',
  );
});

test('A-12: a fully unrelated non-ALL actor is rejected by the read-scope (403)', async () => {
  const w = await seedWonQuote();
  const stranger = await seedUser('stranger');
  const ctx = { user: { id: stranger }, scope: 'OWN' as const };
  await assert.rejects(
    () => service.convertToProject(w.quoteId, {}, stranger, ctx),
    (e: unknown) => e instanceof ForbiddenException,
    'a stranger (not preparer, not any section pricer) must be denied',
  );
});

test('A-12: the preparer can convert — mints exactly one PO (total) + Project + 7 phases', async () => {
  const w = await seedWonQuote();
  const ctx = { user: { id: w.preparer }, scope: 'OWN' as const };
  const project = await service.convertToProject(
    w.quoteId,
    {},
    w.preparer,
    ctx,
  );
  await trackMinted(w.quoteId);

  assert.ok(project?.id, 'a Project was returned');
  assert.equal(
    Number(project.contractValue),
    TOTAL,
    'Project.contractValue equals the quote total',
  );

  const pos = await prisma.purchaseOrder.findMany({
    where: { quoteId: w.quoteId },
  });
  assert.equal(pos.length, 1, 'exactly one PO minted');
  assert.equal(
    Number(pos[0].contractValue),
    TOTAL,
    'PO.contractValue equals the quote total',
  );

  const phases = await prisma.phase.findMany({
    where: { projectId: project.id },
  });
  assert.equal(phases.length, 7, 'the 7-phase default template was created');

  // lifetimeValue bumped by the contract value.
  const client = await prisma.client.findUnique({
    where: { id: w.clientId },
    select: { lifetimeValue: true },
  });
  assert.equal(
    Number(client?.lifetimeValue),
    TOTAL,
    'client lifetimeValue bumped by the contract value',
  );
});

test('A-12: conversion is idempotent — a second call does not double-mint', async () => {
  const w = await seedWonQuote();
  const ctx = { user: { id: w.preparer }, scope: 'OWN' as const };
  await service.convertToProject(w.quoteId, {}, w.preparer, ctx);
  await trackMinted(w.quoteId);

  // A second conversion must be refused (project already exists), not silently
  // mint a second PO + Project.
  await assert.rejects(
    () => service.convertToProject(w.quoteId, {}, w.preparer, ctx),
    (e: unknown) => e instanceof BadRequestException,
    'a second convert must be refused once a project exists',
  );

  const pos = await prisma.purchaseOrder.findMany({
    where: { quoteId: w.quoteId },
  });
  assert.equal(pos.length, 1, 'still exactly one PO after the second call');
  const projects = await prisma.project.findMany({
    where: { po: { quoteId: w.quoteId } },
  });
  assert.equal(
    projects.length,
    1,
    'still exactly one Project after the second call',
  );
});

test('A-12: an ALL-scope actor (no row restriction) can convert', async () => {
  const w = await seedWonQuote();
  // ALL scope = unrestricted; even though this actor is neither preparer nor a
  // pricer, the scope guard must let them through (admin/manager path).
  const admin = await seedUser('admin');
  const ctx = { user: { id: admin }, scope: 'ALL' as const };
  const project = await service.convertToProject(w.quoteId, {}, admin, ctx);
  await trackMinted(w.quoteId);
  assert.ok(project?.id, 'ALL-scope actor converts successfully');
});
