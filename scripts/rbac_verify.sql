-- ABAK ERP — RBAC live DB verifier (pure SQL; no Prisma/ts-node/nx needed).
-- Verifies the seeded RBAC state against docs/testing/abak-rbac-test-plan.md (S1–S6 + invariants).
--
-- RUN (local Docker — container name from docker-compose.yml is "abak-db"):
--   docker exec -i abak-db psql -U abak -d abak_erp -f - < scripts/rbac_verify.sql
-- or with a local psql:
--   psql "postgresql://abak:abak@localhost:5435/abak_erp" -f scripts/rbac_verify.sql
--
-- If every "actual" is 0, the tables exist but the SEEDS have not been run yet:
--   export ABAK_TEST_USER_PASSWORD='Password123!'
--   npx ts-node prisma/seed-abak-real-users.ts && npx ts-node prisma/seed-rbac.ts
-- Note: Prisma maps model fields to camelCase columns, so identifiers are double-quoted.

WITH checks AS (
  SELECT 1 AS ord, 'S4  permissions = 49'                  AS check_name, 49 AS expected,
         (SELECT count(*) FROM permissions)                                       AS actual
  UNION ALL SELECT 2, 'S4  roles = 8', 8,
         (SELECT count(*) FROM roles)
  UNION ALL SELECT 3, 'role_permissions rows > 0 (grants seeded)', 1,
         (SELECT LEAST(count(*),1) FROM role_permissions)
  UNION ALL SELECT 4, 'S2  departments = 12', 12,
         (SELECT count(*) FROM departments)
  UNION ALL SELECT 5, 'S2  inactive departments = 2', 2,
         (SELECT count(*) FROM departments WHERE "isActive" = false)
  UNION ALL SELECT 6, 'S3  managers set = 9', 9,
         (SELECT count(*) FROM departments WHERE "managerId" IS NOT NULL)
  UNION ALL SELECT 7, 'S1  abak.com.sa users = 25', 25,
         (SELECT count(*) FROM users WHERE email LIKE '%@abak.com.sa')
  UNION ALL SELECT 8, 'S1  users with dept + >=1 role = 25', 25,
         (SELECT count(*) FROM users u
            WHERE u."departmentId" IS NOT NULL
              AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra."userId" = u.id))
  UNION ALL SELECT 9, 'S6  hassan@ holds 2 roles', 2,
         (SELECT count(*) FROM role_assignments ra
            JOIN users u ON u.id = ra."userId" WHERE u.email = 'hassan@abak.com.sa')
  UNION ALL SELECT 10, 'Super Admin role isSystem = true', 1,
         (SELECT count(*) FROM roles WHERE name = 'Super Admin' AND "isSystem" = true)
  UNION ALL SELECT 11, 'S3  every manager is a member of the dept they manage', 0,
         (SELECT count(*) FROM departments d
            JOIN users u ON u.id = d."managerId"
            WHERE u."departmentId" IS DISTINCT FROM d.id)              -- expect 0 violations
  UNION ALL SELECT 12, 'manager spot-check: omar@ manages Safety', 1,
         (SELECT count(*) FROM departments d
            JOIN users u ON u.id = d."managerId"
            WHERE u.email = 'omar@abak.com.sa' AND d.name LIKE 'Safety%')
  UNION ALL SELECT 13, 'manager spot-check: w.abid@ is NOT a manager', 0,
         (SELECT count(*) FROM departments WHERE "managerId" =
            (SELECT id FROM users WHERE email = 'w.abid@abak.com.sa'))  -- expect 0
  UNION ALL SELECT 14, 'manager-action keys present in catalog (3)', 3,
         (SELECT count(*) FROM permissions
            WHERE key IN ('rfq:assign_pricers','rfq:set_lead_pricer','project:convert'))
  UNION ALL SELECT 15, 'S5  legacy users.role column still present', 1,
         (SELECT count(*) FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'role')
)
SELECT ord AS "#",
       check_name,
       expected,
       actual,
       CASE WHEN actual = expected THEN 'PASS' ELSE 'FAIL <<<' END AS result
FROM checks
ORDER BY ord;

-- Summary line
WITH checks AS (
  SELECT (SELECT count(*) FROM permissions) = 49
     AND (SELECT count(*) FROM roles) = 8
     AND (SELECT count(*) FROM departments) = 12
     AND (SELECT count(*) FROM departments WHERE "isActive" = false) = 2
     AND (SELECT count(*) FROM departments WHERE "managerId" IS NOT NULL) = 9
     AND (SELECT count(*) FROM users WHERE email LIKE '%@abak.com.sa') = 25
     AND (SELECT count(*) FROM departments d JOIN users u ON u.id = d."managerId"
            WHERE u."departmentId" IS DISTINCT FROM d.id) = 0
     AS all_pass
)
SELECT CASE WHEN all_pass THEN 'ALL CORE CHECKS PASSED'
            ELSE 'SOME CHECKS FAILED — see table above (0 actuals = seeds not run yet)' END AS summary
FROM checks;
