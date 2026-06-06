import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaService } from '../../prisma/prisma.service';

// DATA-1 regression. The seed must NOT give Sales/Department managers the
// legacy role=ADMIN (a latent privilege escalation for any code path that
// trusts role==='ADMIN'). Authz comes from the RoleAssignment / permission set.
// Runs against the live dev Postgres (DATABASE_URL via --env-file).

const prisma = new PrismaService();

after(async () => {
  await prisma.$disconnect();
});

test('DATA-1: the Sales Manager carries role=SALES_MANAGER, not ADMIN', async () => {
  const u = await prisma.user.findUnique({
    where: { email: 'haitham@abak.com.sa' },
    select: {
      role: true,
      roleAssignments: { select: { role: { select: { name: true } } } },
    },
  });
  if (!u) return; // user not seeded in this environment — nothing to assert.
  assert.notEqual(u.role, 'ADMIN', 'Sales Manager must not be legacy ADMIN');
  assert.equal(u.role, 'SALES_MANAGER', 'Sales Manager has the correct enum');
  assert.ok(
    u.roleAssignments.some((a) => a.role.name === 'Sales Manager'),
    'authz still flows from the Sales Manager role assignment',
  );
});

test('DATA-1: the Department Manager carries role=TECHNICAL_MANAGER, not ADMIN', async () => {
  const u = await prisma.user.findUnique({
    where: { email: 'hassan@abak.com.sa' },
    select: {
      role: true,
      roleAssignments: { select: { role: { select: { name: true } } } },
    },
  });
  if (!u) return;
  assert.notEqual(
    u.role,
    'ADMIN',
    'Department Manager must not be legacy ADMIN',
  );
  assert.equal(
    u.role,
    'TECHNICAL_MANAGER',
    'Department Manager has the correct enum',
  );
  assert.ok(
    u.roleAssignments.some((a) => a.role.name === 'Technical Director'),
    'authz still flows from the Technical Director role assignment',
  );
});

test('DATA-1: no non-admin persona user still carries the ADMIN enum', async () => {
  const offenders = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      email: {
        in: [
          'haitham@abak.com.sa',
          'hassan@abak.com.sa',
          // R2-4: akram (dept manager of Environmental Services) was a third
          // ADMIN-carrying manager DATA-1 missed — now TECHNICAL_MANAGER.
          'akram@abak.com.sa',
          'ghadah@abak.com.sa',
          'accounting@abak.com.sa',
          'abdulghani.almuwafiq@abak.com.sa',
        ],
      },
    },
    select: { email: true },
  });
  assert.deepEqual(
    offenders.map((o) => o.email),
    [],
    `these non-admin users still carry role=ADMIN: ${offenders
      .map((o) => o.email)
      .join(', ')}`,
  );
});

test('R2-4/R2-9: akram carries role=TECHNICAL_MANAGER, not ADMIN', async () => {
  const u = await prisma.user.findUnique({
    where: { email: 'akram@abak.com.sa' },
    select: { role: true },
  });
  if (!u) return; // not seeded in this environment.
  assert.equal(
    u.role,
    'TECHNICAL_MANAGER',
    'akram (Environmental Services dept manager) must be TECHNICAL_MANAGER',
  );
});

// R2-9: data-driven guard so future department managers can't silently slip
// through a fixed-email allow-list. NO user who is a Department.managerId may
// carry the legacy role=ADMIN (a latent privilege escalation). The executive
// Chairman/CEO are NOT department managers, so they are not covered here — their
// ADMIN/SUPER_ADMIN tier is a separate owner decision.
test('R2-9: no Department.managerId user carries the ADMIN enum', async () => {
  const depts = await prisma.department.findMany({
    where: { managerId: { not: null } },
    select: { name: true, managerId: true },
  });
  if (depts.length === 0) return;
  const managerIds = depts
    .map((d) => d.managerId)
    .filter((id): id is string => Boolean(id));
  const admins = await prisma.user.findMany({
    where: { id: { in: managerIds }, role: 'ADMIN' },
    select: { id: true, email: true },
  });
  assert.deepEqual(
    admins.map((a) => a.email),
    [],
    `these department managers still carry role=ADMIN: ${admins
      .map((a) => a.email)
      .join(', ')}`,
  );
});
