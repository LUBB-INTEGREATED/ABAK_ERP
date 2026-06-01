# ABAK ERP — RBAC Test Plan (permission-based)

**Status:** Draft — 2026-06-01.
**Pairs with:** `docs/architecture/abak-rbac-design.md` (v2), `prisma/schema.prisma` (RBAC + Department models), `prisma/seed-rbac.ts`.
**Supersedes the role model in:** `abak-user-role-matrix.*` (old fixed `appRole`). The journey scenarios in `abak-role-journey-testing-pack.md` stay valid — just read their role labels as the templates below.

---

## 0. What we now test

The model moved from 8 fixed code-roles to **permissions-as-data**. So testing targets five things, not a static enum:

1. the **permission engine** (resolution, union, scope, deny-by-default),
2. the seeded **role templates**,
3. **department scope** (own / department / all),
4. the **manager designation** (`Department.managerId`),
5. **guard-rails** on RBAC admin.

A test passes only if access is granted/denied for the right _reason_ (a permission + scope), not because a role name happened to match.

## 1. Test accounts (seeded)

| Template                      | Accounts                                                                                                              | Department        | Manager?         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------- |
| Super Admin                   | `abdullah.mohsen@`                                                                                                    | IT                | ✓ (IT)           |
| Executive                     | `mesfer@`, `m.alayaf@`, `salshehri@`                                                                                  | Executive         | —                |
| Sales Manager                 | `haitham@`                                                                                                            | Sales & Marketing | ✓                |
| Sales Rep                     | `ghadah@`, `mostafa@`, `salwa@`, `client.relations1@`, `client.relations2@`                                           | Sales & Marketing | —                |
| Engineer                      | `abdulghani.almuwafiq@`, `a.albittar@`, `hashim.ali@`, `khaled@`, `osamah.alsamet@`, `mohammed.deifallah@`, `w.abid@` | their dept        | —                |
| Engineer + Technical Director | `hassan@`                                                                                                             | Architecture      | ✓ (Architecture) |
| Engineer (also dept manager)  | `alaa.ahmed@` (Surveying), `ameen@` (Supervision), `omar@` (Safety), `akram@` (Environmental)                         | their dept        | ✓                |
| Finance Officer               | `accounting@`                                                                                                         | Finance           | ✓                |
| Viewer                        | `hr@` (Duha), `info@` (system)                                                                                        | HR / Executive    | hr ✓             |

## 2. Permission-engine tests

| #   | Scenario                                         | Expected                                                                              |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| E1  | User with no roles hits any guarded route        | Deny (deny-by-default)                                                                |
| E2  | Required key absent from the user's union        | Deny                                                                                  |
| E3  | Two roles grant the same key at different scopes | Widest scope wins (e.g. `DEPARTMENT` beats `OWN`)                                     |
| E4  | `hassan@` (Engineer + Technical Director)        | Has Engineer keys **and** Technical Director keys; technical actions resolve at `ALL` |
| E5  | Permission set is cached at login                | Changing a role takes effect after token refresh / re-login                           |
| E6  | Non-scopeable permission (e.g. `users:manage`)   | Scope ignored; pure allow/deny                                                        |

## 3. Template allow / deny spot-checks

| Template           | Must allow                                                                | Must deny                                                                   |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Super Admin        | `users:manage`, `settings:manage`, anything                               | (nothing)                                                                   |
| Executive          | `quote:approve`, `project:licence_override`, all `*:view`                 | `users:manage`, `settings:manage`                                           |
| Sales Manager      | `quote:approve` (mid), `settings:manage_pricing_policy`, sales CRUD (ALL) | `users:manage`, `project:convert`, `finance:validate_payment`               |
| Sales Rep          | own `leads:create`, `quote:send`                                          | another rep's lead; `quote:approve`; any RFQ pricing                        |
| Engineer           | own-dept `rfq:price_section`, `project:manage_tasks`                      | another dept's section; `rfq:assign_pricers` (unless manager); `settings:*` |
| Technical Director | act across **all** technical depts, `departments:manage`                  | `users:manage`, `settings:manage`                                           |
| Finance Officer    | `finance:validate_payment`, `finance:closure_gate`                        | `quote:approve`, `rfq:price_section`, sales CRUD                            |
| Viewer             | `*:view` (read)                                                           | any create / edit / approve / manage                                        |

## 4. Department-scope tests

| #   | Scenario                                                   | Expected                           |
| --- | ---------------------------------------------------------- | ---------------------------------- |
| D1  | `omar@` (Engineer, Safety) prices a **Safety** RFQ section | Allow                              |
| D2  | `omar@` tries to price an **Architecture** section         | Deny (cross-department)            |
| D3  | `abdulghani@` (Engineer, Architecture) views projects      | Sees only Architecture-scoped work |
| D4  | `omar@` is Safety's `managerId` → views Safety work        | Sees the whole Safety department   |
| D5  | `hassan@` (Technical Director) views technical work        | Sees **all** technical departments |
| D6  | `ghadah@` (Sales Rep) views leads                          | Sees only her **own** leads        |
| D7  | `haitham@` (Sales Manager) views pipeline                  | Sees the **whole** sales pipeline  |

## 5. Manager-designation tests

| #   | Scenario                                                                                 | Expected                                        |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| M1  | `omar@` (= Safety `managerId`) assigns pricers / sets Lead Pricer / converts a Won quote | Allow, Safety only                              |
| M2  | `w.abid@` (Engineer, Safety, **not** manager) tries the same                             | Deny                                            |
| M3  | `ameen@` (sole engineer **and** manager of Supervision)                                  | Can both price a section **and** assign/convert |
| M4  | Move Safety's `managerId` from `omar@` to `w.abid@`                                      | Manager powers move with it; `omar@` loses them |
| M5  | Try to set a user as manager of a second department                                      | Blocked by `managerId @unique`                  |
| M6  | Manager of dept A tries manager actions in dept B                                        | Deny                                            |

## 6. Guard-rail tests

| #   | Scenario                                            | Expected                       |
| --- | --------------------------------------------------- | ------------------------------ |
| G1  | Delete the **Super Admin** role (`isSystem = true`) | Blocked                        |
| G2  | Delete a role that still has assignments            | Blocked — reassign users first |
| G3  | Remove the last user holding `users:manage`         | Blocked / warned               |
| G4  | An admin removes their own `users:manage`           | Confirmation required          |
| G5  | All role/permission changes                         | Written to the audit log       |

## 7. Controller gating (Phase 1 regression)

The previously **login-only** controllers must now enforce a permission, not just authentication:

`/leads`, `/clients`, `/rfqs`, `/rfqs/:id`, `/quotes`, `/projects`, `/gov-transactions`, `/users`, `/files`, `/notifications`.

| #   | Scenario                                                              | Expected                      |
| --- | --------------------------------------------------------------------- | ----------------------------- |
| C1  | `hr@` (Viewer) POSTs to `/leads`                                      | Deny (no `leads:create`)      |
| C2  | Any authenticated user GETs `/users`                                  | Deny unless `users:view`      |
| C3  | Already-gated admin/finance/reports/settings/holidays/audit endpoints | Still enforce (no regression) |

## 8. Seed / migration verification

| #   | Check                             | Expected                                                       |
| --- | --------------------------------- | -------------------------------------------------------------- |
| S1  | Users with a department + ≥1 role | 25 / 25                                                        |
| S2  | Departments                       | 12 (2 inactive: Haya Mudun, Khibrah)                           |
| S3  | Managers set                      | 9; each manager's `departmentId` == the department they manage |
| S4  | Permissions / roles seeded        | 48 permissions, 8 role templates                               |
| S5  | Legacy `UserRole` enum column     | Still present (migration not yet dropped)                      |
| S6  | `hassan@` role count              | 2 (Engineer + Technical Director)                              |

## 9. How to run

```
# after the migration is applied + client generated
ts-node prisma/seed-abak-real-users.ts   # 25 users (needs ABAK_TEST_USER_PASSWORD)
ts-node prisma/seed-rbac.ts              # permissions, roles, departments, assignments
```

Then execute §2–§8 against a running API. Capture per case: account, endpoint, expected, actual, pass/fail, and any decision needed from Amged/ABAK.
