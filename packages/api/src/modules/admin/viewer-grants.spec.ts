import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaService } from '../../prisma/prisma.service';

// R2-1 regression. The read-only "Viewer" role must NOT carry the admin/global
// :view permissions — granting them lets a Viewer enumerate the whole org + PII
// over the API even though the sidebar hides those modules. Authz comes from the
// seeded RolePermission rows. Runs against the live dev Postgres (DATABASE_URL
// via --env-file); assumes prisma/seed-rbac.ts has been run.

const prisma = new PrismaService();

// The admin/global :view keys a Viewer must never hold.
const FORBIDDEN_VIEWER_KEYS = [
  'users:view',
  'audit:view',
  'finance:view',
  'settings:view',
  'roles:view',
  'departments:view',
  'services:view',
];

// A sample of the operational :view keys a Viewer SHOULD keep.
const EXPECTED_VIEWER_KEYS = [
  'leads:view',
  'clients:view',
  'pipeline:view',
  'quote:view',
  'project:view',
  'reports:view',
];

after(async () => {
  await prisma.$disconnect();
});

async function viewerGrantKeys(): Promise<Set<string> | null> {
  const role = await prisma.role.findUnique({
    where: { name: 'Viewer' },
    select: {
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!role) return null; // role not seeded in this environment.
  return new Set(role.permissions.map((rp) => rp.permission.key));
}

test('R2-1: the Viewer role excludes every admin/global :view key', async () => {
  const keys = await viewerGrantKeys();
  if (!keys) return;
  const leaked = FORBIDDEN_VIEWER_KEYS.filter((k) => keys.has(k));
  assert.deepEqual(
    leaked,
    [],
    `Viewer must not hold admin/global view keys, but has: ${leaked.join(', ')}`,
  );
});

test('R2-1: the Viewer role still holds the operational :view keys', async () => {
  const keys = await viewerGrantKeys();
  if (!keys) return;
  const missing = EXPECTED_VIEWER_KEYS.filter((k) => !keys.has(k));
  assert.deepEqual(
    missing,
    [],
    `Viewer should keep operational view keys, but is missing: ${missing.join(
      ', ',
    )}`,
  );
});
