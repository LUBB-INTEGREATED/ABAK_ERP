import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { RfqDeclineType, RfqStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RfqsService } from './rfqs.service';

// RV-2 regression: a wrong-dept decline must strip the RFQ's RfqAssignment rows
// so the wrong department loses scope on the re-routed request. Runs against the
// live dev Postgres (DATABASE_URL via --env-file).

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const service = new RfqsService(prisma, notifications);

const TAG = `RVTEST-${Date.now()}`;
const trash = {
  rfqIds: [] as string[],
  oppIds: [] as string[],
  clientIds: [] as string[],
};

async function seedClient(): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Decline Test',
      phone: '0500000000',
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  return c.id;
}

after(async () => {
  // assignments cascade with the rfq (onDelete: Cascade)
  for (const id of trash.rfqIds) await prisma.rfq.deleteMany({ where: { id } });
  for (const id of trash.oppIds)
    await prisma.pipelineEntry.deleteMany({ where: { id } });
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('RV-2: WRONG_DEPT decline strips the RFQ assignment rows (scope leak closed)', async () => {
  const clientId = await seedClient();
  const dept = await prisma.serviceCategory.findFirst({ select: { id: true } });
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!dept || !user)
    throw new Error('seed prerequisites (category/user) missing');

  const opp = await prisma.pipelineEntry.create({
    data: { clientId },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}`,
      opportunityId: opp.id,
      clientId,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: RfqStatus.SUBMITTED,
      requestedCategoryIds: [dept.id],
      // the wrong dept's assignment — this is the scope-leak vector.
      assignments: {
        create: [{ assigneeId: user.id, departmentId: dept.id }],
      },
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);

  const before = await prisma.rfqAssignment.count({ where: { rfqId: rfq.id } });
  assert.equal(before, 1, 'seeded one assignment');

  const declined = await service.declineRfq(
    rfq.id,
    { type: RfqDeclineType.WRONG_DEPT, reason: 'not our scope' },
    user.id,
    undefined,
  );

  const after = await prisma.rfqAssignment.count({ where: { rfqId: rfq.id } });
  assert.equal(after, 0, 'wrong-dept decline deleted the assignment rows');
  assert.equal(declined.status, RfqStatus.DECLINED, 'RFQ is DECLINED');
  assert.equal(declined.declineType, RfqDeclineType.WRONG_DEPT);
});

test('RV-2: a NO_BID decline keeps the assignment rows (only WRONG_DEPT strips)', async () => {
  const clientId = await seedClient();
  const dept = await prisma.serviceCategory.findFirst({ select: { id: true } });
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!dept || !user) throw new Error('seed prerequisites missing');

  const opp = await prisma.pipelineEntry.create({
    data: { clientId },
    select: { id: true },
  });
  trash.oppIds.push(opp.id);

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber: `RFQ-${TAG}-NOBID`,
      opportunityId: opp.id,
      clientId,
      serviceType: 'TEST',
      projectScope: 'TEST',
      requestedByChannel: 'INTERNAL_REP',
      status: RfqStatus.SUBMITTED,
      requestedCategoryIds: [dept.id],
      assignments: {
        create: [{ assigneeId: user.id, departmentId: dept.id }],
      },
    },
    select: { id: true },
  });
  trash.rfqIds.push(rfq.id);

  await service.declineRfq(
    rfq.id,
    { type: RfqDeclineType.NO_BID, reason: 'no bid' },
    user.id,
    undefined,
  );

  const after = await prisma.rfqAssignment.count({ where: { rfqId: rfq.id } });
  assert.equal(after, 1, 'NO_BID decline keeps the assignment rows');
});
