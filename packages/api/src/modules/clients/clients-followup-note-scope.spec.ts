import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClientsService } from './clients.service';
import { AuditService } from '../audit/audit.service';
import type { UpdateFollowUpDto } from './dto';

// A-13 / A-14 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). updateFollowUp and deleteNote used to mutate by bare id with no
// scope context, so an OWN-scoped actor (Sales Rep with comms:log) could
// edit/cancel a follow-up or delete a note of a client they don't manage. The
// fix threads the scope and runs assertOwnership via findOne(clientId). These
// tests assert the object-level gate: a non-manager 403s; the manager succeeds.

const prisma = new PrismaService();
const notifications = {
  send: async () => undefined,
  sendToMany: async () => undefined,
} as unknown as NotificationsService;
const audit = { log: async () => undefined } as unknown as AuditService;
const service = new ClientsService(prisma, notifications, audit);

const TAG = `TEST-A1314-${Date.now()}`;
const trash = {
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

async function seedClient(managerId: string): Promise<string> {
  const c = await prisma.client.create({
    data: {
      clientNumber: `CLI-${TAG}-${trash.clientIds.length}`,
      contactName: 'Scope Test',
      phone: '0500000000',
      accountManagerId: managerId,
    },
    select: { id: true },
  });
  trash.clientIds.push(c.id);
  return c.id;
}

after(async () => {
  for (const id of trash.clientIds)
    await prisma.client.deleteMany({ where: { id } });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('A-13: an OWN actor cannot update a follow-up of a client they do not manage', async () => {
  const manager = await seedUser('manager');
  const stranger = await seedUser('stranger');
  const clientId = await seedClient(manager);
  const followUp = await service.createFollowUp(
    clientId,
    { title: 'Call client', dueAt: new Date().toISOString() },
    manager,
    { user: { id: manager }, scope: 'ALL' },
  );

  const strangerCtx = { user: { id: stranger }, scope: 'OWN' as const };
  await assert.rejects(
    () =>
      service.updateFollowUp(
        followUp.id,
        { status: 'CANCELLED' } as unknown as UpdateFollowUpDto,
        strangerCtx,
      ),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-managing rep must not mutate the follow-up',
  );
});

test('A-13: the account manager can update the follow-up', async () => {
  const manager = await seedUser('manager');
  const clientId = await seedClient(manager);
  const followUp = await service.createFollowUp(
    clientId,
    { title: 'Call client', dueAt: new Date().toISOString() },
    manager,
    { user: { id: manager }, scope: 'ALL' },
  );

  const managerCtx = { user: { id: manager }, scope: 'OWN' as const };
  const updated = await service.updateFollowUp(
    followUp.id,
    {
      status: 'COMPLETED',
      outcome: 'Spoke with the client and confirmed scope.',
    } as unknown as UpdateFollowUpDto,
    managerCtx,
  );
  assert.equal(updated.status, 'COMPLETED', 'the manager can update');
});

test('A-14: an OWN actor cannot delete a note of a client they do not manage', async () => {
  const manager = await seedUser('manager');
  const stranger = await seedUser('stranger');
  const clientId = await seedClient(manager);
  const note = await service.createNote(
    clientId,
    { body: 'sensitive note' },
    manager,
    { user: { id: manager }, scope: 'ALL' },
  );

  const strangerCtx = { user: { id: stranger }, scope: 'OWN' as const };
  await assert.rejects(
    () => service.deleteNote(note.id, strangerCtx),
    (e: unknown) => e instanceof ForbiddenException,
    'a non-managing rep must not delete the note',
  );
});

test('A-14: the account manager can delete the note', async () => {
  const manager = await seedUser('manager');
  const clientId = await seedClient(manager);
  const note = await service.createNote(
    clientId,
    { body: 'sensitive note' },
    manager,
    { user: { id: manager }, scope: 'ALL' },
  );

  const managerCtx = { user: { id: manager }, scope: 'OWN' as const };
  const deleted = await service.deleteNote(note.id, managerCtx);
  assert.equal(deleted.id, note.id, 'the manager can delete the note');
});
