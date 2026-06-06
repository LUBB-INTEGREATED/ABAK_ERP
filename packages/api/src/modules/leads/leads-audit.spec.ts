import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AssignmentService } from './assignment.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { LeadsService } from './leads.service';
import type { ScopeContext } from '../auth/scope.util';

// DATA-6 regression. Business-document actions (here: a lead status transition)
// must write an audit row — not just admin entities. Uses a REAL AuditService so
// the row is persisted, then asserts + cleans up. Runs against the live dev DB.

const prisma = new PrismaService();
const config = { get: () => undefined } as unknown as ConfigService;
const assignment = {
  pickAssignee: async () => undefined,
} as unknown as AssignmentService;
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const audit = new AuditService(prisma);
const service = new LeadsService(prisma, config, assignment, notifications, audit);

const TAG = `TEST-DATA6-${Date.now()}`;
const trash = { leadIds: [] as string[], userIds: [] as string[] };

after(async () => {
  for (const id of trash.leadIds) {
    await prisma.auditLog.deleteMany({ where: { entity: 'Lead', entityId: id } });
    await prisma.lead.deleteMany({ where: { id } });
  }
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DATA-6: a lead status transition writes an audit row', async () => {
  const rep = await prisma.user.create({
    data: {
      email: `${TAG}-rep@example.com`,
      password: 'x',
      firstName: 'Rep',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  trash.userIds.push(rep.id);

  const lead = await prisma.lead.create({
    data: {
      leadNumber: `LEAD-${TAG}-1`,
      channel: 'WEBSITE',
      contactName: 'Audit Test',
      phone: '0500000001',
      status: 'IN_PROGRESS',
      assignedToId: rep.id,
      createdBy: rep.id,
      firstResponseAt: new Date(),
    },
    select: { id: true },
  });
  trash.leadIds.push(lead.id);

  const ctx: ScopeContext = { user: { id: rep.id }, scope: 'ALL' };
  await service.updateStatus(lead.id, { status: 'QUALIFIED' as never }, ctx);

  const rows = await prisma.auditLog.findMany({
    where: { entity: 'Lead', entityId: lead.id },
  });
  assert.ok(rows.length >= 1, 'an audit row was written for the lead');
  const row = rows.find((r) => r.action === 'LEAD_STATUS_QUALIFIED');
  assert.ok(row, 'the audit row records the QUALIFIED transition');
  assert.equal(row?.userId, rep.id, 'the actor is recorded on the audit row');
});
