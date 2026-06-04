import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DepartmentsService } from './departments.service';
import type { ScopeContext } from '../auth/scope.util';

// DM-15a (RV2-1) regression. Runs against the live dev Postgres (DATABASE_URL
// via --env-file). Instantiates DepartmentsService directly with a real Prisma
// client + an inert audit stub. Asserts the manager-scope object-level rule:
// an ALL-scoped caller lists any department; a DEPARTMENT-scoped manager only
// the one they manage; cross-dept and non-manager callers are refused.

const prisma = new PrismaService();
const audit = { log: async () => undefined } as unknown as AuditService;
const service = new DepartmentsService(prisma, audit);

const TAG = `TEST-DM15A-${Date.now()}`;
const trash = { deptIds: [] as string[], userIds: [] as string[] };

async function seedUser(label: string, departmentId?: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}-${label}-${trash.userIds.length}@example.com`,
      password: 'x',
      firstName: label,
      lastName: 'Tester',
      status: 'ACTIVE',
      departmentId,
    },
    select: { id: true },
  });
  trash.userIds.push(u.id);
  return u.id;
}

async function seedDept(label: string): Promise<string> {
  const d = await prisma.department.create({
    data: { name: `${TAG}-${label}` },
    select: { id: true },
  });
  trash.deptIds.push(d.id);
  return d.id;
}

after(async () => {
  // Null out manager links first so users can be deleted, then members.
  for (const id of trash.deptIds)
    await prisma.department.updateMany({
      where: { id },
      data: { managerId: null },
    });
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  for (const id of trash.deptIds)
    await prisma.department.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DM-15a: a manager lists their own department members (+ manager flagged)', async () => {
  const deptA = await seedDept('A');
  const mgr = await seedUser('mgr', deptA);
  const eng = await seedUser('eng', deptA);
  await prisma.department.update({
    where: { id: deptA },
    data: { managerId: mgr },
  });

  const ctx: ScopeContext = {
    user: { id: mgr, departmentId: deptA, managedDepartment: { id: deptA } },
    scope: 'DEPARTMENT',
  };
  const members = await service.listMembers(deptA, ctx);
  const ids = members.map((m) => m.id).sort();
  assert.deepEqual(ids, [mgr, eng].sort(), 'lists both dept members once each');
  const mgrRow = members.find((m) => m.id === mgr);
  assert.equal(mgrRow?.isManager, true, 'the manager is flagged isManager');
  const engRow = members.find((m) => m.id === eng);
  assert.equal(engRow?.isManager, false, 'a plain member is not flagged');
});

test('DM-15a: cross-department list is refused for a DEPARTMENT-scoped manager', async () => {
  const deptA = await seedDept('A2');
  const deptB = await seedDept('B2');
  const mgr = await seedUser('mgr2', deptA);
  await seedUser('engB', deptB);
  await prisma.department.update({
    where: { id: deptA },
    data: { managerId: mgr },
  });

  const ctx: ScopeContext = {
    user: { id: mgr, departmentId: deptA, managedDepartment: { id: deptA } },
    scope: 'DEPARTMENT',
  };
  await assert.rejects(
    () => service.listMembers(deptB, ctx),
    /only list members of a department you manage/i,
    'manager of dept A cannot list dept B',
  );
});

test('DM-15a: a non-manager member is refused even for their own department', async () => {
  const deptA = await seedDept('A3');
  const member = await seedUser('plain', deptA);

  const ctx: ScopeContext = {
    user: { id: member, departmentId: deptA, managedDepartment: null },
    scope: 'DEPARTMENT',
  };
  await assert.rejects(
    () => service.listMembers(deptA, ctx),
    /only list members of a department you manage/i,
    'a plain member (no managedDepartment) is refused',
  );
});

test('DM-15a: an ALL-scoped caller may list any department', async () => {
  const deptA = await seedDept('A4');
  const eng = await seedUser('engA4', deptA);

  const ctx: ScopeContext = {
    user: { id: 'someone-else', managedDepartment: null },
    scope: 'ALL',
  };
  const members = await service.listMembers(deptA, ctx);
  assert.ok(
    members.some((m) => m.id === eng),
    'ALL scope lists the department even when not the manager',
  );
});

test('DM-15a: unknown department id is a 404', async () => {
  await assert.rejects(
    () => service.listMembers('does-not-exist', undefined),
    /not found/i,
    'missing department surfaces NotFound',
  );
});
