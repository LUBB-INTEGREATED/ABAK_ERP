import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RfqAssignmentsService } from './rfq-assignments.service';
import type { RfqsService } from './rfqs.service';

// DM-15b (RV2-2) regression. Runs against the live dev Postgres (DATABASE_URL
// via --env-file). A duplicate assignment on the same (rfqId, departmentId) —
// e.g. re-accepting an RFQ that already has that section assigned — must throw
// ConflictException (→ HTTP 409), not let the Prisma P2002 bubble as a 500.

const prisma = new PrismaService();
// assertCanAccess is the only RfqsService method createAssignment touches.
const rfqs = {
  assertCanAccess: async () => undefined,
} as unknown as RfqsService;
const service = new RfqAssignmentsService(prisma, rfqs);

const TAG = `TEST-DM15B-${Date.now()}`;
const trash = {
  rfqIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
};

async function aDepartmentId(): Promise<string> {
  const cat = await prisma.serviceCategory.findFirst({ select: { id: true } });
  if (!cat) throw new Error('No ServiceCategory in DB to use as a department');
  return cat.id;
}

async function aUserId(): Promise<string> {
  const u = await prisma.user.findFirst({ select: { id: true } });
  if (!u) throw new Error('No User in DB to use as the assignee');
  return u.id;
}

async function seedRfq(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Assign Conflict Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  const opp = await prisma.pipelineEntry.create({
    data: { clientId: c.id },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);
  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}-${trash.rfqIds.length}`,
      opportunityId: opp.id,
      clientId: c.id,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: 'ASSIGNED',
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);
  return rfq.id;
}

after(async () => {
  for (const id of trash.rfqIds)
    await prisma.rfqAssignment.deleteMany({ where: { rfqId: id } });
  for (const id of trash.rfqIds) await prisma.rfq.deleteMany({ where: { id } });
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DM-15b: duplicate (rfqId, departmentId) assignment → 409, not 500', async () => {
  const rfqId = await seedRfq();
  const departmentId = await aDepartmentId();
  const assigneeId = await aUserId();

  const first = await service.createAssignment(rfqId, {
    departmentId,
    assigneeId,
  });
  assert.ok(first.id, 'first assignment is created');

  await assert.rejects(
    () => service.createAssignment(rfqId, { departmentId, assigneeId }),
    (err: unknown) => {
      assert.ok(
        err instanceof ConflictException,
        'duplicate is a ConflictException (HTTP 409)',
      );
      assert.match((err as ConflictException).message, /already assigned/i);
      return true;
    },
    'a second assignment on the same department is refused',
  );
});

test('DM-15b: a different department on the same RFQ still succeeds', async () => {
  const cats = await prisma.serviceCategory.findMany({
    select: { id: true },
    take: 2,
  });
  if (cats.length < 2) return; // needs two distinct departments
  const rfqId = await seedRfq();
  const assigneeId = await aUserId();

  const a = await service.createAssignment(rfqId, {
    departmentId: cats[0].id,
    assigneeId,
  });
  const b = await service.createAssignment(rfqId, {
    departmentId: cats[1].id,
    assigneeId,
  });
  assert.ok(a.id && b.id, 'two distinct departments both assign');
  assert.notEqual(a.id, b.id);
});
