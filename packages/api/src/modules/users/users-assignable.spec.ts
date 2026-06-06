import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaService } from '../../prisma/prisma.service';
import type { PermissionsService } from '../auth/permissions.service';
import { UsersService } from './users.service';

// DATA-4 regression. A Sales Rep lacks users:view (GET /users 403 → empty
// assign-to dropdown). The dedicated assignable endpoint returns the caller's
// own department teammates (a non-empty scoped list) without enumerating the
// whole org. Runs against the live dev Postgres.

const prisma = new PrismaService();
const permissions = {
  resolveForUser: async () => new Map(),
} as unknown as PermissionsService;
const service = new UsersService(prisma, permissions);

const TAG = `TEST-DATA4-${Date.now()}`;
const trash = { deptIds: [] as string[], userIds: [] as string[] };

async function seedDept(label: string): Promise<string> {
  const d = await prisma.department.create({
    data: { name: `${TAG}-${label}`, type: 'SALES' },
    select: { id: true },
  });
  trash.deptIds.push(d.id);
  return d.id;
}

async function seedUser(label: string, departmentId?: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}-${label}-${trash.userIds.length}@example.com`,
      password: 'x',
      firstName: label,
      status: 'ACTIVE',
      departmentId,
    },
    select: { id: true },
  });
  trash.userIds.push(u.id);
  return u.id;
}

after(async () => {
  for (const id of trash.userIds)
    await prisma.user.deleteMany({ where: { id } });
  for (const id of trash.deptIds)
    await prisma.department.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('DATA-4: a scoped rep gets their own-department teammates (non-empty)', async () => {
  const salesDept = await seedDept('sales');
  const otherDept = await seedDept('other');
  const rep = await seedUser('rep', salesDept);
  const teammate = await seedUser('teammate', salesDept);
  const outsider = await seedUser('outsider', otherDept);

  const result = await service.findAssignable({
    id: rep,
    departmentId: salesDept,
    scope: 'OWN',
  });

  const ids = result.users.map((u) => u.id);
  assert.ok(result.count > 0, 'the list is not empty');
  assert.ok(ids.includes(rep), 'the caller is assignable');
  assert.ok(ids.includes(teammate), 'a same-department teammate is assignable');
  assert.ok(
    !ids.includes(outsider),
    'an other-department user is NOT in the scoped list',
  );
});

test('DATA-4: an ALL-scoped caller sees users beyond their department', async () => {
  const deptA = await seedDept('allA');
  const deptB = await seedDept('allB');
  const caller = await seedUser('allcaller', deptA);
  const elsewhere = await seedUser('elsewhere', deptB);

  const result = await service.findAssignable({
    id: caller,
    departmentId: deptA,
    scope: 'ALL',
  });
  const ids = result.users.map((u) => u.id);
  assert.ok(ids.includes(elsewhere), 'ALL scope includes other departments');
});
