import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AssignmentService } from './assignment.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { LeadsService } from './leads.service';
import type { ScopeContext } from '../auth/scope.util';

// DATA-3 regression. The KPI/stats endpoint must apply the SAME owner scope as
// the list query, so a scoped (OWN) actor's headline total equals their scoped
// list count — not the global total. Runs against the live dev Postgres.

const prisma = new PrismaService();
const config = {
  get: () => undefined,
} as unknown as ConfigService;
const assignment = {
  pickAssignee: async () => undefined,
} as unknown as AssignmentService;
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const service = new LeadsService(prisma, config, assignment, notifications);

const TAG = `TEST-DATA3-${Date.now()}`;
const trash = { leadIds: [] as string[], userIds: [] as string[] };

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

async function seedLead(assignedToId: string, n: number): Promise<void> {
  const l = await prisma.lead.create({
    data: {
      leadNumber: `LEAD-${TAG}-${n}`,
      channel: 'WEBSITE',
      contactName: `Lead ${n}`,
      phone: `05000000${n}`,
      status: 'ASSIGNED',
      assignedToId,
      createdBy: assignedToId,
    },
    select: { id: true },
  });
  trash.leadIds.push(l.id);
}

after(async () => {
  for (const id of trash.leadIds)
    await prisma.lead.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DATA-3: a scoped actor stats total == their scoped list total', async () => {
  const repA = await seedUser('repA');
  const repB = await seedUser('repB');
  // 2 leads for repA, 3 for repB.
  await seedLead(repA, 1);
  await seedLead(repA, 2);
  await seedLead(repB, 3);
  await seedLead(repB, 4);
  await seedLead(repB, 5);

  const ctxA: ScopeContext = { user: { id: repA }, scope: 'OWN' };

  const listA = await service.findAll({}, ctxA);
  const statsA = await service.stats(ctxA);

  assert.equal(listA.pagination.total, 2, 'repA list shows only their 2 leads');
  assert.equal(
    statsA.total,
    listA.pagination.total,
    'repA stats total equals their scoped list total (not the global 5)',
  );

  // And an ALL-scoped (unrestricted) caller sees both reps' leads in stats.
  const statsAll = await service.stats({ user: { id: repA }, scope: 'ALL' });
  assert.ok(
    statsAll.total >= 5,
    'an ALL-scoped caller sees the global total (>= the 5 we seeded)',
  );
  assert.ok(
    statsAll.total > statsA.total,
    'the global total is strictly larger than the scoped total',
  );
});
