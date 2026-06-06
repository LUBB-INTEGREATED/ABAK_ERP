import 'reflect-metadata';
import { after, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DepartmentsService } from './departments.service';

// CHAIN-1 regression. Runs against the live dev Postgres (DATABASE_URL via
// --env-file). Two guarantees:
//  1. The seeded catalog resolves: every ACTIVE ServiceCategory maps to >=1
//     ACTIVE department via DepartmentService (so a new RFQ section can always
//     be accepted/assigned — the live P0 blocker).
//  2. The new admin link/unlink/list endpoints CRUD correctly + are idempotent.

const prisma = new PrismaService();
const audit = { log: async () => undefined } as unknown as AuditService;
const service = new DepartmentsService(prisma, audit);

const TAG = `TEST-CHAIN1-${Date.now()}`;
const trash = { deptIds: [] as string[], catIds: [] as string[] };

after(async () => {
  for (const id of trash.deptIds)
    await prisma.departmentService.deleteMany({ where: { departmentId: id } });
  for (const id of trash.catIds)
    await prisma.departmentService.deleteMany({
      where: { serviceCategoryId: id },
    });
  for (const id of trash.catIds)
    await prisma.serviceCategory.deleteMany({ where: { id } });
  for (const id of trash.deptIds)
    await prisma.department.deleteMany({ where: { id } });
  await prisma.$disconnect();
});

test('CHAIN-1: every active service category resolves to >=1 active department', async () => {
  const activeCategories = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  assert.ok(
    activeCategories.length > 0,
    'there are active categories to check',
  );

  const unresolved: string[] = [];
  for (const cat of activeCategories) {
    const link = await prisma.departmentService.findFirst({
      where: {
        serviceCategoryId: cat.id,
        department: { isActive: true },
      },
      select: { departmentId: true },
    });
    if (!link) unresolved.push(cat.name);
  }
  assert.deepEqual(
    unresolved,
    [],
    `these active categories resolve to no active department: ${unresolved.join(', ')}`,
  );
});

test('CHAIN-1: link / list / unlink CRUD is correct and idempotent', async () => {
  const dept = await prisma.department.create({
    data: { name: `${TAG}-dept`, type: 'TECHNICAL' },
    select: { id: true },
  });
  trash.deptIds.push(dept.id);
  const cat = await prisma.serviceCategory.create({
    data: { name: `${TAG}-cat` },
    select: { id: true },
  });
  trash.catIds.push(cat.id);

  // Initially unlinked.
  let links = await service.listServiceLinks(dept.id);
  assert.equal(links.length, 0, 'no links before linking');

  // Link.
  await service.linkService(dept.id, cat.id, 'tester');
  links = await service.listServiceLinks(dept.id);
  assert.equal(links.length, 1, 'one link after linking');
  assert.equal(links[0].id, cat.id, 'the linked category is returned');

  // Idempotent re-link is a no-op (no duplicate, no throw).
  await service.linkService(dept.id, cat.id, 'tester');
  links = await service.listServiceLinks(dept.id);
  assert.equal(links.length, 1, 'still one link after a duplicate link');

  // The link is queryable the way RFQ intake folds it (cat -> active dept).
  const resolved = await prisma.departmentService.findFirst({
    where: { serviceCategoryId: cat.id, department: { isActive: true } },
    select: { departmentId: true },
  });
  assert.equal(
    resolved?.departmentId,
    dept.id,
    'category resolves to the dept',
  );

  // Unlink.
  await service.unlinkService(dept.id, cat.id, 'tester');
  links = await service.listServiceLinks(dept.id);
  assert.equal(links.length, 0, 'no links after unlinking');

  // Idempotent unlink is a no-op.
  await service.unlinkService(dept.id, cat.id, 'tester');
  links = await service.listServiceLinks(dept.id);
  assert.equal(links.length, 0, 'still no links after a duplicate unlink');
});

test('CHAIN-1: linking a missing department or category is a 404', async () => {
  const cat = await prisma.serviceCategory.create({
    data: { name: `${TAG}-cat2` },
    select: { id: true },
  });
  trash.catIds.push(cat.id);

  await assert.rejects(
    () => service.linkService('does-not-exist', cat.id, 'tester'),
    /Department not found/i,
    'missing department -> 404',
  );

  const dept = await prisma.department.create({
    data: { name: `${TAG}-dept2`, type: 'TECHNICAL' },
    select: { id: true },
  });
  trash.deptIds.push(dept.id);
  await assert.rejects(
    () => service.linkService(dept.id, 'does-not-exist', 'tester'),
    /Service category not found/i,
    'missing category -> 404',
  );
});
