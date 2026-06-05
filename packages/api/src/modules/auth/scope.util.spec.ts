import 'reflect-metadata';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import {
  assertOwnerOrCreator,
  assertOwnership,
  departmentScopeFilter,
  isUnrestricted,
  ownerOrCreatorScopeFilter,
  ownerScopeFilter,
  projectScopeFilter,
  rfqScopeFilter,
  type ScopeContext,
} from './scope.util';

// A-11 (authz boundary). The PermissionGuard resolves a permission's scope tier
// (OWN | DEPARTMENT | ALL) onto request.permissionScopes; the eight primitives
// in scope.util translate that tier into a Prisma `where` fragment (list reads)
// or an object-level ForbiddenException (detail read + mutate-by-id). A bug in
// any of these widens or breaks access across EVERY module that delegates to
// them, so this suite pins each tier of each primitive. Pure functions — no DB.

const UID = 'user-self';
const OTHER = 'user-other';
const DEPT = 'dept-1';

function ctx(
  scope: ScopeContext['scope'],
  over: Partial<ScopeContext['user']> = {},
): ScopeContext {
  return {
    scope,
    user: { id: UID, ...over },
  };
}

// ─── isUnrestricted ────────────────────────────────────────────────

test('isUnrestricted: undefined ctx is unrestricted', () => {
  assert.equal(isUnrestricted(undefined), true);
});

test('isUnrestricted: ctx with no scope is unrestricted', () => {
  assert.equal(isUnrestricted({ user: { id: UID } }), true);
});

test('isUnrestricted: ALL is unrestricted; OWN and DEPARTMENT are restricted', () => {
  assert.equal(isUnrestricted(ctx('ALL')), true);
  assert.equal(isUnrestricted(ctx('OWN')), false);
  assert.equal(isUnrestricted(ctx('DEPARTMENT')), false);
});

// ─── ownerScopeFilter ──────────────────────────────────────────────

test('ownerScopeFilter: ALL / undefined → no restriction ({})', () => {
  assert.deepEqual(ownerScopeFilter(ctx('ALL'), 'ownerId'), {});
  assert.deepEqual(ownerScopeFilter(undefined, 'ownerId'), {});
});

test('ownerScopeFilter: OWN → pins the owner column to the actor', () => {
  assert.deepEqual(ownerScopeFilter(ctx('OWN'), 'ownerId'), { ownerId: UID });
});

test('ownerScopeFilter: DEPARTMENT collapses to OWN (no dept column on owner entities)', () => {
  assert.deepEqual(ownerScopeFilter(ctx('DEPARTMENT'), 'assignedToId'), {
    assignedToId: UID,
  });
});

// ─── ownerOrCreatorScopeFilter ─────────────────────────────────────

test('ownerOrCreatorScopeFilter: ALL / undefined → no restriction ({})', () => {
  assert.deepEqual(ownerOrCreatorScopeFilter(ctx('ALL'), 'assignedToId'), {});
  assert.deepEqual(ownerOrCreatorScopeFilter(undefined, 'assignedToId'), {});
});

test('ownerOrCreatorScopeFilter: OWN → OR over owner and creator columns', () => {
  assert.deepEqual(ownerOrCreatorScopeFilter(ctx('OWN'), 'assignedToId'), {
    OR: [{ assignedToId: UID }, { createdBy: UID }],
  });
});

test('ownerOrCreatorScopeFilter: honours a custom creator field', () => {
  assert.deepEqual(
    ownerOrCreatorScopeFilter(ctx('OWN'), 'assignedToId', 'raisedBy'),
    { OR: [{ assignedToId: UID }, { raisedBy: UID }] },
  );
});

// ─── departmentScopeFilter ─────────────────────────────────────────

test('departmentScopeFilter: ALL / undefined → no restriction ({})', () => {
  const fields = { departmentField: 'departmentId', ownerField: 'ownerId' };
  assert.deepEqual(departmentScopeFilter(ctx('ALL'), fields), {});
  assert.deepEqual(departmentScopeFilter(undefined, fields), {});
});

test('departmentScopeFilter: DEPARTMENT manager → whole managed department', () => {
  const fields = { departmentField: 'departmentId', ownerField: 'ownerId' };
  const res = departmentScopeFilter(
    ctx('DEPARTMENT', { managedDepartment: { id: DEPT } }),
    fields,
  );
  assert.deepEqual(res, { departmentId: DEPT });
});

test('departmentScopeFilter: DEPARTMENT member (no managedDepartment) falls back to their departmentId', () => {
  const fields = { departmentField: 'departmentId', ownerField: 'ownerId' };
  const res = departmentScopeFilter(
    ctx('DEPARTMENT', { departmentId: DEPT }),
    fields,
  );
  assert.deepEqual(res, { departmentId: DEPT });
});

test('departmentScopeFilter: DEPARTMENT with no department at all → narrows to OWN', () => {
  const fields = { departmentField: 'departmentId', ownerField: 'ownerId' };
  const res = departmentScopeFilter(ctx('DEPARTMENT'), fields);
  assert.deepEqual(res, { ownerId: UID });
});

test('departmentScopeFilter: OWN → owner column only (ignores any department)', () => {
  const fields = { departmentField: 'departmentId', ownerField: 'ownerId' };
  const res = departmentScopeFilter(
    ctx('OWN', { departmentId: DEPT, managedDepartment: { id: DEPT } }),
    fields,
  );
  assert.deepEqual(res, { ownerId: UID });
});

// ─── rfqScopeFilter ────────────────────────────────────────────────

test('rfqScopeFilter: ALL / undefined → no restriction ({})', () => {
  assert.deepEqual(rfqScopeFilter(ctx('ALL')), {});
  assert.deepEqual(rfqScopeFilter(undefined), {});
});

test('rfqScopeFilter: OWN (sales rep) → originated OR created-by RFQs', () => {
  assert.deepEqual(rfqScopeFilter(ctx('OWN')), {
    OR: [{ originalSalesRepId: UID }, { createdBy: UID }],
  });
});

test('rfqScopeFilter: DEPARTMENT (engineer) → RFQs assigned to them', () => {
  assert.deepEqual(rfqScopeFilter(ctx('DEPARTMENT')), {
    assignments: { some: { assigneeId: UID } },
  });
});

// ─── projectScopeFilter ────────────────────────────────────────────

test('projectScopeFilter: ALL / undefined → no restriction ({})', () => {
  assert.deepEqual(projectScopeFilter(ctx('ALL')), {});
  assert.deepEqual(projectScopeFilter(undefined), {});
});

test('projectScopeFilter: OWN (engineer) → projects they personally touch (PM / phase owner / task assignee)', () => {
  assert.deepEqual(projectScopeFilter(ctx('OWN')), {
    OR: [
      { pmId: UID },
      { phases: { some: { ownerId: UID } } },
      { phases: { some: { tasks: { some: { assigneeId: UID } } } } },
    ],
  });
});

test('projectScopeFilter: DEPARTMENT manager → any project their department works on', () => {
  assert.deepEqual(
    projectScopeFilter(ctx('DEPARTMENT', { managedDepartment: { id: DEPT } })),
    {
      OR: [
        { pm: { departmentId: DEPT } },
        { phases: { some: { owner: { departmentId: DEPT } } } },
        {
          phases: {
            some: { tasks: { some: { assignee: { departmentId: DEPT } } } },
          },
        },
      ],
    },
  );
});

test('projectScopeFilter: DEPARTMENT actor without a managed department falls back to personal involvement', () => {
  // No managedDepartment.id → deptId undefined → personal-involvement branch.
  assert.deepEqual(projectScopeFilter(ctx('DEPARTMENT')), {
    OR: [
      { pmId: UID },
      { phases: { some: { ownerId: UID } } },
      { phases: { some: { tasks: { some: { assigneeId: UID } } } } },
    ],
  });
});

// ─── assertOwnership (object-level: detail read + mutate-by-id) ────

test('assertOwnership: ALL / undefined ctx → never throws (unrestricted)', () => {
  assert.doesNotThrow(() =>
    assertOwnership(ctx('ALL'), { ownerId: OTHER }, 'ownerId'),
  );
  assert.doesNotThrow(() =>
    assertOwnership(undefined, { ownerId: OTHER }, 'ownerId'),
  );
});

test('assertOwnership: null entity → never throws (caller surfaces 404)', () => {
  assert.doesNotThrow(() => assertOwnership(ctx('OWN'), null, 'ownerId'));
  assert.doesNotThrow(() => assertOwnership(ctx('OWN'), undefined, 'ownerId'));
});

test('assertOwnership: OWN actor on their own record → allowed', () => {
  assert.doesNotThrow(() =>
    assertOwnership(ctx('OWN'), { ownerId: UID }, 'ownerId'),
  );
});

test('assertOwnership: OWN actor on someone else’s record → 403', () => {
  assert.throws(
    () => assertOwnership(ctx('OWN'), { ownerId: OTHER }, 'ownerId'),
    ForbiddenException,
  );
});

test('assertOwnership: DEPARTMENT collapses to OWN here → non-owner still 403', () => {
  assert.throws(
    () =>
      assertOwnership(
        ctx('DEPARTMENT', { managedDepartment: { id: DEPT } }),
        { ownerId: OTHER },
        'ownerId',
      ),
    ForbiddenException,
  );
});

// ─── assertOwnerOrCreator ──────────────────────────────────────────

test('assertOwnerOrCreator: ALL / undefined ctx → never throws', () => {
  assert.doesNotThrow(() =>
    assertOwnerOrCreator(
      ctx('ALL'),
      { assignedToId: OTHER, createdBy: OTHER },
      'assignedToId',
    ),
  );
  assert.doesNotThrow(() =>
    assertOwnerOrCreator(
      undefined,
      { assignedToId: OTHER, createdBy: OTHER },
      'assignedToId',
    ),
  );
});

test('assertOwnerOrCreator: owner matches → allowed', () => {
  assert.doesNotThrow(() =>
    assertOwnerOrCreator(
      ctx('OWN'),
      { assignedToId: UID, createdBy: OTHER },
      'assignedToId',
    ),
  );
});

test('assertOwnerOrCreator: creator matches (re-assigned away from actor) → allowed', () => {
  assert.doesNotThrow(() =>
    assertOwnerOrCreator(
      ctx('OWN'),
      { assignedToId: OTHER, createdBy: UID },
      'assignedToId',
    ),
  );
});

test('assertOwnerOrCreator: neither owner nor creator → 403', () => {
  assert.throws(
    () =>
      assertOwnerOrCreator(
        ctx('OWN'),
        { assignedToId: OTHER, createdBy: OTHER },
        'assignedToId',
      ),
    ForbiddenException,
  );
});

test('assertOwnerOrCreator: honours a custom creator field', () => {
  assert.doesNotThrow(() =>
    assertOwnerOrCreator(
      ctx('OWN'),
      { assignedToId: OTHER, raisedBy: UID },
      'assignedToId',
      'raisedBy',
    ),
  );
  assert.throws(
    () =>
      assertOwnerOrCreator(
        ctx('OWN'),
        { assignedToId: OTHER, raisedBy: OTHER },
        'assignedToId',
        'raisedBy',
      ),
    ForbiddenException,
  );
});
