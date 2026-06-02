/**
 * ABAK RBAC offline verifier (no database / no Prisma engine needed).
 *
 * Validates the authorization pieces that are pure logic + data:
 *   1. scope.util.ts row-level filters (the REAL transpiled module)
 *   2. permission-union "widest scope wins" algorithm (mirrors permissions.service.ts)
 *   3. PermissionGuard manager-designation unlock decision (mirrors permission.guard.ts)
 *   4. seed integrity vs. the RBAC test plan (counts + cross-references)
 *
 * Run from the repo root:  node scripts/rbac_verify.js
 * Requires: Node >= 18 and the dev `typescript` dependency (already in the workspace).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const SCOPE_SRC = path.join(
  REPO,
  'packages/api/src/modules/auth/scope.util.ts',
);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rbac-verify-'));

// Transpile the pure scope.util module (it has no runtime imports) so we can
// test its real output rather than a re-implementation.
execSync(
  `npx tsc "${SCOPE_SRC}" --outDir "${TMP}" --module commonjs --target es2021 --skipLibCheck`,
  { cwd: REPO, stdio: 'inherit' },
);
const scope = require(path.join(TMP, 'scope.util.js'));

let pass = 0,
  fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    fails.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n=== 1. scope.util.ts (real transpiled module) ===');
const mgr = {
  id: 'u1',
  departmentId: 'dSafety',
  managedDepartment: { id: 'dSafety' },
};
const eng = { id: 'u2', departmentId: 'dSafety', managedDepartment: null };
const rep = { id: 'u3', departmentId: 'dSales', managedDepartment: null };

ok(
  'owner ALL -> {}',
  eq(scope.ownerScopeFilter({ user: rep, scope: 'ALL' }, 'assignedToId'), {}),
);
ok(
  'owner OWN -> {assignedToId:uid}',
  eq(scope.ownerScopeFilter({ user: rep, scope: 'OWN' }, 'assignedToId'), {
    assignedToId: 'u3',
  }),
);
ok(
  'owner undefined ctx -> {}',
  eq(scope.ownerScopeFilter(undefined, 'assignedToId'), {}),
);
ok(
  'dept ALL -> {}',
  eq(
    scope.departmentScopeFilter(
      { user: mgr, scope: 'ALL' },
      { departmentField: 'departmentId', ownerField: 'ownerId' },
    ),
    {},
  ),
);
ok(
  'dept manager -> whole dept',
  eq(
    scope.departmentScopeFilter(
      { user: mgr, scope: 'DEPARTMENT' },
      { departmentField: 'departmentId', ownerField: 'ownerId' },
    ),
    { departmentId: 'dSafety' },
  ),
);
ok(
  'dept member(no mgr) DEPARTMENT -> own dept',
  eq(
    scope.departmentScopeFilter(
      { user: eng, scope: 'DEPARTMENT' },
      { departmentField: 'departmentId', ownerField: 'ownerId' },
    ),
    { departmentId: 'dSafety' },
  ),
);
ok(
  'dept OWN -> ownerId',
  eq(
    scope.departmentScopeFilter(
      { user: eng, scope: 'OWN' },
      { departmentField: 'departmentId', ownerField: 'ownerId' },
    ),
    { ownerId: 'u2' },
  ),
);
ok('rfq ALL -> {}', eq(scope.rfqScopeFilter({ user: mgr, scope: 'ALL' }), {}));
ok(
  'rfq DEPARTMENT(engineer) -> assigned to me',
  eq(scope.rfqScopeFilter({ user: eng, scope: 'DEPARTMENT' }), {
    assignments: { some: { assigneeId: 'u2' } },
  }),
);
ok(
  'rfq OWN(sales rep) -> originated by me',
  eq(scope.rfqScopeFilter({ user: rep, scope: 'OWN' }), {
    originalSalesRepId: 'u3',
  }),
);
ok(
  'project ALL -> {}',
  eq(scope.projectScopeFilter({ user: mgr, scope: 'ALL' }), {}),
);
const pm = scope.projectScopeFilter({ user: mgr, scope: 'DEPARTMENT' });
ok(
  'project manager -> dept OR filter',
  !!pm.OR && pm.OR.some((c) => c.pm && c.pm.departmentId === 'dSafety'),
  JSON.stringify(pm),
);
const pe = scope.projectScopeFilter({ user: eng, scope: 'DEPARTMENT' });
ok(
  'project member(no mgr) -> personal involvement',
  !!pe.OR && pe.OR.some((c) => c.pmId === 'u2'),
  JSON.stringify(pe),
);

console.log('\n=== 2. permission-union algorithm ===');
const RANK = { OWN: 1, DEPARTMENT: 2, ALL: 3 };
const union = (grants) => {
  const m = new Map();
  for (const g of grants) {
    const c = m.get(g.key);
    if (!c || RANK[g.scope] > RANK[c]) m.set(g.key, g.scope);
  }
  return m;
};
const u = union([
  { key: 'rfq:view', scope: 'OWN' },
  { key: 'rfq:view', scope: 'DEPARTMENT' },
  { key: 'quote:view', scope: 'ALL' },
]);
ok('E3 widest scope wins', u.get('rfq:view') === 'DEPARTMENT');
ok('E2 absent key -> deny', u.get('users:manage') === undefined);

console.log('\n=== 3. manager-unlock guard decision ===');
const MANAGER_ACTION_KEYS = new Set([
  'rfq:assign_pricers',
  'rfq:set_lead_pricer',
  'project:convert',
]);
function guard(required, map, isManager) {
  const scopes = {};
  for (const k of required) {
    if (map.has(k)) {
      scopes[k] = map.get(k);
      continue;
    }
    if (isManager && MANAGER_ACTION_KEYS.has(k)) {
      scopes[k] = 'DEPARTMENT';
      continue;
    }
    return { allowed: false };
  }
  return { allowed: true, scopes };
}
const engMap = union([
  { key: 'rfq:view', scope: 'DEPARTMENT' },
  { key: 'rfq:price_section', scope: 'DEPARTMENT' },
]);
const tdMap = union([{ key: 'rfq:assign_pricers', scope: 'ALL' }]);
ok(
  'M1 manager CAN assign_pricers (DEPARTMENT)',
  guard(['rfq:assign_pricers'], engMap, true).scopes?.['rfq:assign_pricers'] ===
    'DEPARTMENT',
);
ok(
  'M1 manager CAN project:convert',
  guard(['project:convert'], engMap, true).allowed === true,
);
ok(
  'M2 non-manager CANNOT assign_pricers',
  guard(['rfq:assign_pricers'], engMap, false).allowed === false,
);
ok(
  'Technical Director keeps ALL via role',
  guard(['rfq:assign_pricers'], tdMap, false).scopes?.['rfq:assign_pricers'] ===
    'ALL',
);
ok(
  'no leak to non-manager key',
  guard(['rfq:price_section'], union([]), true).allowed === false,
);

console.log('\n=== 4. seed integrity vs. test plan ===');
const rbac = fs.readFileSync(path.join(REPO, 'prisma/seed-rbac.ts'), 'utf8');
const usersSeed = fs.readFileSync(
  path.join(REPO, 'prisma/seed-abak-real-users.ts'),
  'utf8',
);
const slice = (t, s, e) => {
  const i = t.indexOf(s);
  const j = e ? t.indexOf(e, i + 1) : t.length;
  return t.slice(i, j === -1 ? t.length : j);
};

const catalog = [...rbac.matchAll(/mk\(\s*'([^']+)'/g)].map((m) => m[1]);
ok(
  'catalog = 49 permissions (design §3)',
  catalog.length === 49,
  'got ' + catalog.length,
);
ok('catalog keys unique', new Set(catalog).size === catalog.length);
const catSet = new Set(catalog);

const rolesBlock = slice(rbac, 'const ROLES', 'function resolveGrants');
const roleNames = [...rolesBlock.matchAll(/name:\s*'([^']+)'/g)].map(
  (m) => m[1],
);
ok('8 role templates', roleNames.length === 8, 'got ' + roleNames.length);

const deptBlock = slice(rbac, 'const DEPARTMENTS', 'const ASSIGNMENTS');
ok(
  '12 departments',
  [...deptBlock.matchAll(/name:\s*'([^']+)'/g)].length === 12,
);
ok(
  '2 inactive departments',
  [...deptBlock.matchAll(/isActive:\s*false/g)].length === 2,
);
const managerEmails = [...deptBlock.matchAll(/managerEmail:\s*'([^']+)'/g)].map(
  (m) => m[1],
);
ok('9 managers', managerEmails.length === 9, 'got ' + managerEmails.length);

const asgBlock = slice(rbac, 'const ASSIGNMENTS', 'async function main');
const asgEmails = [...asgBlock.matchAll(/email:\s*'([^']+)'/g)].map(
  (m) => m[1],
);
ok('25 user assignments', asgEmails.length === 25, 'got ' + asgEmails.length);
const userEmails = [...usersSeed.matchAll(/email:\s*'([^']+)'/g)].map(
  (m) => m[1],
);
ok('25 users seeded', userEmails.length === 25, 'got ' + userEmails.length);
const userSet = new Set(userEmails);
ok(
  'every assignment email exists in user seed',
  asgEmails.every((e) => userSet.has(e)),
);
ok(
  'every manager email exists in user seed',
  managerEmails.every((e) => userSet.has(e)),
);

const emailToDept = {};
for (const m of asgBlock.matchAll(
  /email:\s*'([^']+)',\s*department:\s*'([^']+)',\s*roles/g,
))
  emailToDept[m[1]] = m[2];
const deptObjs = [
  ...deptBlock.matchAll(
    /name:\s*'([^']+)',\s*nameAr:[\s\S]*?order:\s*\d+,?(?:\s*managerEmail:\s*'([^']+)',?)?\s*\}/g,
  ),
].map((m) => ({ name: m[1], managerEmail: m[2] || null }));
ok(
  'each manager is a member of the dept they manage',
  deptObjs
    .filter((d) => d.managerEmail)
    .every((d) => emailToDept[d.managerEmail] === d.name),
);

const rgBlock = slice(rbac, 'function resolveGrants', 'const DEPARTMENTS');
const badGrants = [
  ...new Set([...rgBlock.matchAll(/'([a-z_]+:[a-z_]+)'/g)].map((m) => m[1])),
].filter((k) => !catSet.has(k));
ok(
  'all explicit grant keys exist in catalog',
  badGrants.length === 0,
  'unknown: ' + badGrants.join(', '),
);

const roleSet = new Set(roleNames);
const used = new Set();
[...asgBlock.matchAll(/roles:\s*\[([^\]]*)\]/g)].forEach((m) =>
  [...m[1].matchAll(/'([^']+)'/g)].forEach((x) => used.add(x[1])),
);
ok(
  'every assigned role name is a defined template',
  [...used].every((r) => roleSet.has(r)),
);
['rfq:assign_pricers', 'rfq:set_lead_pricer', 'project:convert'].forEach((k) =>
  ok('manager-action key in catalog: ' + k, catSet.has(k)),
);

console.log('\n=====================================================');
console.log(`RESULT: ${pass} passed, ${fail} failed`);
fs.rmSync(TMP, { recursive: true, force: true });
if (fail) {
  console.log('FAILURES:');
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
