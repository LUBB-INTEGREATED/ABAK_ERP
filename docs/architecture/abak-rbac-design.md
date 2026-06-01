# ABAK ERP — RBAC & Org-Structure Design (v2 — permission-based)

**Status:** Draft for review — 2026-06-01.
**Approach decision:** roles are **data**, not a fixed code enum. Chosen path: **build the flexible foundation now, ship the admin "role builder" screen as Phase 2.**
**Scope:** design package (no code yet).
**Supersedes:** v1's static `UserRole`-enum model. The 3-axis intuition, department model, and people mapping carry over; how _roles_ are defined is what changed.
**Inputs:** `أباك_قائمة_مستخدمي_النظام_2026_v4.xlsx`, `prisma/schema.prisma`, `MVP_SCOPE.md`, `docs/personas/*`, `docs/testing/*`.

---

## 1. What changed from v1, and why

v1 hard-wired a fixed set of roles into the code (`SUPER_ADMIN`, `ENGINEER`, …) and gated routes with `@Roles(...)`. That is rigid: adding "Regional Director" means a code change and a deploy.

Proper RBAC treats a **role as a named bundle of permissions** that an admin assigns — the name is just a label. So roles become **data you compose**, not constants you ship. This doc designs that, in two layers so it stays controllable.

## 2. The model in one picture

Three orthogonal things — only the first changes from v1:

| Concept        | Question                            | Form                                                            | Who controls it                                    |
| -------------- | ----------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| **Permission** | _what action is possible?_          | fixed catalog (`module:action`)                                 | developers (one-time, grows with features)         |
| **Role**       | _which permissions, at what scope?_ | **data** — created/edited freely                                | admins (Phase 2: via UI; Phase 1: via config/seed) |
| **Department** | _whose records?_                    | scope on each granted permission (`own` / `department` / `all`) | admins, per role                                   |
| **Position**   | _what's the title?_                 | display label                                                   | HR — never gates anything                          |

So: **permission = the verb the system supports · role = a chosen set of those verbs + scope · department = whose data · position = label.**

## 3. The permission catalog (the fixed vocabulary)

Developers define this once; each entry is wired to a real guarded action. Admins can't invent permissions — they compose roles _from_ this menu. It grows only when new features ship. "Scopeable" = the permission can be limited to own / department / all records.

| Module           | Actions (permission keys)                                                                                    | Scopeable? |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| Leads            | `leads:view` `leads:create` `leads:edit`                                                                     | ✅         |
| Clients          | `clients:view` `clients:create` `clients:edit`                                                               | ✅         |
| Communications   | `comms:view` `comms:log`                                                                                     | ✅         |
| Pipeline         | `pipeline:view` `pipeline:move` `pipeline:log_visit`                                                         | ✅         |
| RFQs             | `rfq:view` `rfq:request` `rfq:assign_pricers` `rfq:set_lead_pricer` `rfq:price_section` `rfq:request_docs`   | ✅         |
| Quotes           | `quote:view` `quote:build` `quote:submit_approval` `quote:approve` `quote:send` `quote:set_outcome`          | ✅         |
| Projects         | `project:view` `project:convert` `project:manage_tasks` `project:manage_licences` `project:licence_override` | ✅         |
| Finance          | `finance:view` `finance:validate_payment` `finance:manage_invoice` `finance:closure_gate`                    | ✅         |
| Gov transactions | `gov:view` `gov:manage`                                                                                      | ✅         |
| Reports          | `reports:view` `reports:export`                                                                              | ✅         |
| Services catalog | `services:view` `services:manage`                                                                            | — (global) |
| Departments      | `departments:view` `departments:manage`                                                                      | — (global) |
| Users            | `users:view` `users:manage`                                                                                  | — (global) |
| Settings         | `settings:view` `settings:manage` `settings:manage_pricing_policy` `settings:manage_holidays`                | — (global) |
| Audit log        | `audit:view`                                                                                                 | — (global) |
| RBAC admin       | `roles:view` `roles:manage` _(Phase 2 — edit roles/permissions)_                                             | — (global) |

## 4. Data model

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : "assigned via"
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : "granted via"
  USER }o--|| DEPARTMENT : "belongs to"
  DEPARTMENT |o--|| USER : "managed by (managerId)"
  DEPARTMENT ||--o{ DEPARTMENT_SERVICE : exposes
  SERVICE_CATEGORY ||--o{ DEPARTMENT_SERVICE : "mapped from"

  PERMISSION { string key PK "rfq:price_section"; string module; string action; boolean scopeable }
  ROLE { string id PK; string name; string nameAr; boolean isSystem; boolean isAssignable }
  ROLE_PERMISSION { string roleId FK; string permissionId FK; Scope scope "OWN | DEPARTMENT | ALL" }
  USER_ROLE { string userId FK; string roleId FK }
  USER { string id PK; string departmentId FK; string positionTitle; UserStatus status }
  DEPARTMENT { string id PK; string name; DeptType type; string managerId FK; boolean isActive }
  DEPARTMENT_SERVICE { string departmentId FK; string serviceCategoryId FK }
}
```

Notes:

- A user can hold **one or more roles**; their effective permissions = the union, taking the widest scope if two roles grant the same key.
- `Role.isSystem` locks a role from deletion (e.g. a permanent Super Admin); `isAssignable=false` hides retired roles.
- `Scope` lives on the **role↔permission** link, so the same permission can be "own" in one role and "department" in another.
- `Department`, `User.departmentId`, `Department.managerId`, and the service link are unchanged from v1.

## 5. How an access decision is made at runtime

The guard changes from role-checking to **permission-checking**:

```
v1:  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
v2:  @RequirePermission('settings:manage')
```

1. On login, resolve the user's effective permission set (union of their roles' permissions + scope) and cache it on the session/token.
2. `PermissionGuard` checks the route's required key against that set — pass/deny.
3. For **scopeable** permissions, the service layer applies the scope filter:
   - `OWN` → `record.ownerId == user.id`
   - `DEPARTMENT` → `record.departmentId == user.departmentId` (managers/directors see the whole department)
   - `ALL` → no filter.
4. **Manager actions** (`rfq:assign_pricers`, `rfq:set_lead_pricer`, `project:convert`) are unlocked for the engineer where `Department.managerId == user.id` — the manager designation, not a separate role. Promoting a manager stays a one-field change.

This is **RBAC + a scope attribute** — deliberately short of full ABAC, to stay inside `MVP_SCOPE.md`.

## 6. Seeded role templates

These ship as **starting roles** (data, editable). They are the v1 roles, now expressed as permission bundles. Admins clone/tweak them or build new ones — no code change.

| Template                            | Key permissions (from the catalog)                                                                                                  | Default scope |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Super Admin** _(locked)_          | everything, incl. `users:manage` `roles:manage` `settings:*` `audit:view`                                                           | All           |
| **Executive**                       | `*:view`, `quote:approve`, `project:licence_override`, `reports:*` — **no** `users`/`settings:manage`                               | All           |
| **Sales Manager**                   | `leads/clients/pipeline/quote:*` (manage), `quote:approve` (mid-tier), `reports:view`                                               | All (sales)   |
| **Sales Rep**                       | `leads/clients/comms/pipeline` create+edit, `rfq:request`, `quote:send` `quote:set_outcome`                                         | Own           |
| **Engineer**                        | `rfq:price_section` `rfq:request_docs` `quote:build` `project:manage_tasks` `project:manage_licences` `clients:view` `reports:view` | Department    |
| **Technical Director** _(optional)_ | Engineer permissions across **all** technical departments + `departments:manage`                                                    | All technical |
| **Finance Officer**                 | `finance:*` `quote:view` `reports:view`                                                                                             | All           |
| **Viewer**                          | `*:view` only (no create/edit/approve)                                                                                              | per grant     |

**Manager** is _not_ a template — it's the `Department.managerId` designation, which unlocks `rfq:assign_pricers`, `rfq:set_lead_pricer`, and `project:convert` for that one department. So a manager is an Engineer with the hat, exactly as you described.

## 7. Department & manager model (carried from v1)

- `Department` is first-class and admin-manageable (create / rename / activate / deactivate, set a manager). Distinct from `ServiceCategory` (the billable price list); technical departments **link** to one or more services.
- A user belongs to one department; `Department.managerId` points to **one of that department's own engineers**, who keeps engineer powers and gains the manager bundle.
- A **one-engineer department** = that sole engineer is also `managerId`. No special case.
- Non-technical departments (Sales, Finance, HR, IT, Executive) carry `DeptType` and need no service link.

## 8. The 25 accounts → template roles

"Mgr?" = is this person their department's `managerId` (unlocks the manager bundle).

| Person                                    | Template role(s)                       | Department          | Mgr? | Position (display)      |
| ----------------------------------------- | -------------------------------------- | ------------------- | :--: | ----------------------- |
| Abdullah Mohsen                           | Super Admin                            | IT (`SUPPORT`)      |  ✓   | IT & Biz-Dev Manager    |
| Mesfer Alqahtani                          | Executive                              | Executive           |  —   | Board Chairman          |
| Mohammed Alayaf                           | Executive                              | Executive           |  —   | CEO                     |
| Saleh Alshehri                            | Executive                              | Executive           |  —   | Exec Dir, Business Dev  |
| info@abak.com.sa                          | Viewer (system)                        | —                   |  —   | System account          |
| Hassan Salah                              | Engineer + Technical Director          | Architecture        |  ✓   | Arch Mgr + PMO Director |
| Abdulghani, Ahmad, Hashim, Khaled, Osamah | Engineer                               | Architecture        |  —   | Engineer                |
| Alaa Ahmed                                | Engineer                               | Surveying           |  ✓   | Engineer (dept manager) |
| Mohammed Deifallah                        | Engineer                               | Surveying           |  —   | Engineer                |
| Ameen Alnhari                             | Engineer                               | Supervision & Civil |  ✓   | sole engineer = manager |
| Omar Rababah                              | Engineer                               | Safety              |  ✓   | Dept Manager            |
| Waleed bin Abid                           | Engineer                               | Safety              |  —   | Engineer                |
| Akram Abdullah                            | Engineer                               | Environmental       |  ✓   | Dept Manager            |
| Haitham Mohamady                          | Sales Manager                          | Sales & Marketing   |  ✓   | Dept Manager            |
| Ghadah, Mostafa, Salwa                    | Sales Rep                              | Sales & Marketing   |  —   | Sales                   |
| Rahma Tareq, Mohammed Alatiyyat           | Sales Rep                              | Sales & Marketing   |  —   | Client Relations        |
| Ahmed Elibairy                            | Finance Officer                        | Finance             |  ✓   | Accountant              |
| Duha Al-awam                              | Viewer _(HR template when contracted)_ | HR                  |  ✓   | HR Manager              |

## 9. Phasing

**Phase 1 — flexible foundation (now):**

- Schema: `Permission`, `Role`, `RolePermission(scope)`, `UserRole`, `Department`, `User.departmentId`, `Department.managerId`, `DepartmentService`.
- Seed the permission catalog (§3) + the template roles (§6) + assign the 25 users.
- Replace `@Roles` with `@RequirePermission('key')` + `PermissionGuard`; apply scope filters in services.
- **Gate the currently login-only controllers** (`/leads` `/clients` `/rfqs` `/quotes` `/projects` `/gov-transactions` `/users`).
- Web `can(user, 'key', record)` helper so nav/pages/buttons hide consistently.
- Roles are editable via **seed/config** — fully flexible underneath, no UI yet.

**Phase 2 — role builder UI (addendum):**

- The admin screen (the mockup): roles list, permission matrix with scope selectors, assign-users, duplicate.
- RBAC change audit + guard-rails UI.

**Still out of scope (per `MVP_SCOPE.md`):** full ABAC (per-record rules beyond department scope), Client Portal, external magic-link access, cross-project PMO capacity.

## 10. Implementation notes (Phase 1, design-level)

1. Add the five RBAC tables + `Department`/`DeptType`; seed catalog, templates, departments (2 inactive: Haya Mudun, Khibrah).
2. Reconcile pricing: keep `ServiceCategory` as the price list; have `RfqAssignment`/`QuoteItem` resolve their department via the `Department↔Service` link (or add `departmentId`).
3. Permission resolution: compute the union once per login, cache on session/JWT, invalidate on role change.
4. Migration of existing users: map current `UserRole` enum values → template roles (one-time script).
5. Keep a permanent locked Super Admin so the system can never be locked out.

## 11. Decisions (locked 2026-06-01)

1. **Surveying manager:** Alaa Ahmed.
2. **Saleh Alshehri:** Executive only.
3. **Technical Director template:** kept — Hassan; grants `departments:manage` over technical departments.
4. **Multiple roles per user:** allowed — a user may hold several roles; effective permissions = the union (widest scope wins).
5. **HR & Marketing:** stay out of MVP — Duha = Viewer until HR is contracted; Marketing (Module 5) deferred.

## 12. Trade-offs & risks

- **Testing shifts** from "test 8 fixed roles" to "test the permission engine + the seeded templates." The role-journey pack in `docs/testing/` should be reframed around permissions/templates.
- **Guard-rails needed:** locked Super Admin, can't remove the last user-admin, can't delete a role that's in use, confirm-on-self-downgrade.
- **Performance:** resolve permissions once and cache; don't query per request.
- **Auditability:** log every role/permission change (the `audit` module already exists).
- **Misconfiguration risk:** ship sensible templates so admins rarely build from scratch — the templates are the safety net.
