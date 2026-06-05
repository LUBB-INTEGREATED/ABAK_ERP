import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { GovAuthorityCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GovTransactionsService } from './gov-transactions.service';
import type { UpdateGovTransactionDto } from './dto';

// A-25 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). gov:* are scopeable and GovTransaction carries assignedProId /
// assignedEngineerId / createdBy, but no scope was threaded — so any scoped
// actor could read/mutate any gov tx by id (OWN/DEPARTMENT ignored). The fix
// adds govScopeWhere + assertGovInScope on list + detail + mutate. These tests
// assert a scoped actor can't read or mutate another owner's gov tx, and the
// real owner can.

const prisma = new PrismaService();
const service = new GovTransactionsService(prisma);

const TAG = `TEST-A25-${Date.now()}`;
const trash = {
  txIds: [] as string[],
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

// Builds the minimal client → quote → PO → project chain that GovTransaction's
// required projectId FK needs.
async function seedProject(pmId: string): Promise<string> {
  const client = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Gov Scope Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(client.id);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-${TAG}-${trash.quoteIds.length}`,
      clientId: client.id,
      title: 'Gov scope',
    },
    select: { id: true },
  });
  trash.quoteIds.push(quote.id);
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: `PO-${TAG}-${trash.poIds.length}`,
      quoteId: quote.id,
      clientId: client.id,
      contractValue: 1000,
    },
    select: { id: true },
  });
  trash.poIds.push(po.id);
  const project = await prisma.project.create({
    data: {
      projectNumber: `PRJ-${TAG}-${trash.projectIds.length}`,
      poId: po.id,
      clientId: client.id,
      pmId,
      title: 'Gov scope project',
      contractValue: 1000,
    },
    select: { id: true },
  });
  trash.projectIds.push(project.id);
  return project.id;
}

async function seedGovTx(projectId: string, assignedProId: string) {
  const tx = await prisma.govTransaction.create({
    data: {
      transactionNumber: `GOV-${TAG}-${trash.txIds.length}`,
      projectId,
      authorityName: 'Authority',
      authorityCategory: GovAuthorityCategory.MUNICIPALITY,
      transactionType: 'PERMIT',
      assignedProId,
      createdBy: assignedProId,
    },
    select: { id: true },
  });
  trash.txIds.push(tx.id);
  return tx.id;
}

after(async () => {
  for (const id of trash.txIds)
    await prisma.govTransaction.deleteMany({ where: { id } });
  for (const id of trash.projectIds)
    await prisma.project.deleteMany({ where: { id } });
  for (const id of trash.poIds)
    await prisma.purchaseOrder.deleteMany({ where: { id } });
  for (const id of trash.quoteIds)
    await prisma.quote.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('A-25: a scoped actor cannot READ another owner gov tx by id', async () => {
  const owner = await seedUser('owner');
  const stranger = await seedUser('stranger');
  const projectId = await seedProject(owner);
  const txId = await seedGovTx(projectId, owner);

  const strangerCtx = { user: { id: stranger }, scope: 'OWN' as const };
  await assert.rejects(
    () => service.findOne(txId, strangerCtx),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-owner must not read the gov tx by id',
  );
});

test('A-25: a scoped actor cannot MUTATE another owner gov tx', async () => {
  const owner = await seedUser('owner');
  const stranger = await seedUser('stranger');
  const projectId = await seedProject(owner);
  const txId = await seedGovTx(projectId, owner);

  const strangerCtx = { user: { id: stranger }, scope: 'OWN' as const };
  await assert.rejects(
    () =>
      service.update(
        txId,
        { authorityName: 'hijacked' } as UpdateGovTransactionDto,
        strangerCtx,
      ),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-owner must not update the gov tx',
  );
});

test('A-25: the assigned owner can read and mutate their gov tx', async () => {
  const owner = await seedUser('owner');
  const projectId = await seedProject(owner);
  const txId = await seedGovTx(projectId, owner);

  const ownerCtx = { user: { id: owner }, scope: 'OWN' as const };
  const read = await service.findOne(txId, ownerCtx);
  assert.equal(read.id, txId, 'the owner can read their gov tx');
  const updated = await service.update(
    txId,
    { authorityName: 'owner-edit' } as UpdateGovTransactionDto,
    ownerCtx,
  );
  assert.equal(updated.authorityName, 'owner-edit', 'the owner can update');
});

test('A-25: an unrestricted (ALL) actor is not filtered', async () => {
  const owner = await seedUser('owner');
  const admin = await seedUser('admin');
  const projectId = await seedProject(owner);
  const txId = await seedGovTx(projectId, owner);

  const adminCtx = { user: { id: admin }, scope: 'ALL' as const };
  const read = await service.findOne(txId, adminCtx);
  assert.equal(read.id, txId, 'ALL scope reads any gov tx');
});

test('A-25: list is scoped — a stranger does not see another owner tx', async () => {
  const owner = await seedUser('owner');
  const stranger = await seedUser('stranger');
  const projectId = await seedProject(owner);
  const txId = await seedGovTx(projectId, owner);

  const strangerCtx = { user: { id: stranger }, scope: 'OWN' as const };
  const res = await service.list({ pageSize: 100 }, strangerCtx);
  const ids = res.data.map((r) => r.id);
  assert.ok(!ids.includes(txId), 'the stranger must not see the owner tx');

  const ownerCtx = { user: { id: owner }, scope: 'OWN' as const };
  const ownerRes = await service.list({ pageSize: 100 }, ownerCtx);
  assert.ok(
    ownerRes.data.map((r) => r.id).includes(txId),
    'the owner sees their own tx in the list',
  );
});
