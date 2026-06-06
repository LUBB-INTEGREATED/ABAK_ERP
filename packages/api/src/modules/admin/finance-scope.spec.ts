import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaService } from '../../prisma/prisma.service';

// DATA-5 regression. Finance was over-restricted (clients/projects 403) but
// needs READ for billing context. The Finance Officer role now grants
// clients:view + project:view (read) while writes stay gated. Runs against the
// live dev Postgres (seed-rbac applied).

const prisma = new PrismaService();

after(async () => {
  await prisma.$disconnect();
});

async function financeKeys(): Promise<Set<string>> {
  const role = await prisma.role.findUnique({
    where: { name: 'Finance Officer' },
    include: {
      permissions: { include: { permission: { select: { key: true } } } },
    },
  });
  assert.ok(role, 'the Finance Officer role is seeded');
  return new Set(role!.permissions.map((rp) => rp.permission.key));
}

test('DATA-5: Finance Officer can READ clients and projects', async () => {
  const keys = await financeKeys();
  assert.ok(keys.has('clients:view'), 'Finance has clients:view');
  assert.ok(keys.has('project:view'), 'Finance has project:view');
});

test('DATA-5: Finance Officer cannot WRITE clients/projects (reads only)', async () => {
  const keys = await financeKeys();
  assert.ok(!keys.has('clients:create'), 'no clients:create');
  assert.ok(!keys.has('clients:edit'), 'no clients:edit');
  assert.ok(!keys.has('project:convert'), 'no project:convert');
  assert.ok(!keys.has('project:manage_tasks'), 'no project:manage_tasks');
  // Leads stay out of finance scope.
  assert.ok(!keys.has('leads:view'), 'no leads:view');
});
