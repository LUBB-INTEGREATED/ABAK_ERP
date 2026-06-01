/**
 * ABAK ERP — RBAC v2 seed (Phase 1 foundation)
 * Design: docs/architecture/abak-rbac-design.md
 *
 * Seeds: permission catalog (§3) → role templates (§6) → departments (§7)
 *        → assigns the 25 real users to departments + roles (§8) → sets managers.
 *
 * Idempotent (upserts). RUN ORDER:
 *   1. prisma migrate dev   (apply the RBAC + Department tables)
 *   2. prisma generate
 *   3. ts-node prisma/seed-abak-real-users.ts   (creates the 25 users)
 *   4. ts-node prisma/seed-rbac.ts              (this file)
 *
 * Manager actions (rfq:assign_pricers, rfq:set_lead_pricer, project:convert) are
 * NOT granted via a role for ordinary department managers — they are unlocked by
 * Department.managerId in the PermissionGuard. This seed only sets managerId.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Local string-unions mirror the new Prisma enums (assignable as enum values).
type Scope = 'OWN' | 'DEPARTMENT' | 'ALL';
type DeptType =
  | 'TECHNICAL'
  | 'SALES'
  | 'FINANCE'
  | 'HR'
  | 'EXECUTIVE'
  | 'SUPPORT';

// ---------------------------------------------------------------------------
// 1. Permission catalog (the fixed vocabulary)
// ---------------------------------------------------------------------------
const mk = (key: string, scopeable: boolean, description: string) => {
  const [module, action] = key.split(':');
  return { key, module, action, scopeable, description };
};

const PERMISSIONS = [
  // record-bearing (scopeable)
  mk('leads:view', true, 'View leads'),
  mk('leads:create', true, 'Create a lead'),
  mk('leads:edit', true, 'Edit a lead'),
  mk('clients:view', true, 'View clients'),
  mk('clients:create', true, 'Create a client'),
  mk('clients:edit', true, 'Edit a client'),
  mk('comms:view', true, 'View the communications log'),
  mk('comms:log', true, 'Log an interaction / follow-up'),
  mk('pipeline:view', true, 'View the sales pipeline'),
  mk('pipeline:move', true, 'Move a pipeline stage'),
  mk('pipeline:log_visit', true, 'Log a field visit'),
  mk('rfq:view', true, 'View RFQs'),
  mk('rfq:request', true, 'Request an RFQ from a lead'),
  mk('rfq:assign_pricers', true, 'Assign pricers to RFQ sections (manager)'),
  mk('rfq:set_lead_pricer', true, 'Designate the Lead Pricer (manager)'),
  mk('rfq:price_section', true, 'Price an RFQ section'),
  mk('rfq:request_docs', true, 'Request missing docs / site visit'),
  mk('quote:view', true, 'View quotes'),
  mk('quote:build', true, 'Build / edit a quote section'),
  mk('quote:submit_approval', true, 'Assemble & submit a quote for approval'),
  mk('quote:approve', true, 'Approve a quote per value threshold'),
  mk('quote:send', true, 'Send a quote to the client'),
  mk('quote:set_outcome', true, 'Mark a quote Won / Lost / Postponed'),
  mk('project:view', true, 'View projects'),
  mk('project:convert', true, 'Convert a Won quote into a project (manager)'),
  mk('project:manage_tasks', true, 'Manage project phases / tasks / Gantt'),
  mk('project:manage_licences', true, 'Add / track government licences'),
  mk('project:licence_override', true, 'Override a licence-exemption block'),
  mk('finance:view', true, 'View finance surfaces'),
  mk('finance:validate_payment', true, 'Validate a payment'),
  mk('finance:manage_invoice', true, 'Manage invoices'),
  mk('finance:closure_gate', true, 'Pass the project closure finance gate'),
  mk('gov:view', true, 'View government transactions'),
  mk('gov:manage', true, 'Manage government transactions'),
  mk('reports:view', true, 'View reports & dashboards'),
  mk('reports:export', true, 'Export reports'),
  // global (not scopeable)
  mk('services:view', false, 'View the service catalog'),
  mk('services:manage', false, 'Manage the service catalog'),
  mk('departments:view', false, 'View departments'),
  mk(
    'departments:manage',
    false,
    'Create / edit / deactivate departments, set managers',
  ),
  mk('users:view', false, 'View users'),
  mk('users:manage', false, 'Create / edit users and their roles'),
  mk('settings:view', false, 'View system settings'),
  mk('settings:manage', false, 'Manage system settings'),
  mk(
    'settings:manage_pricing_policy',
    false,
    'Manage the pricing / approval policy',
  ),
  mk('settings:manage_holidays', false, 'Manage the public-holiday calendar'),
  mk('audit:view', false, 'View the audit log'),
  mk('roles:view', false, 'View roles & permissions (Phase 2)'),
  mk('roles:manage', false, 'Create / edit roles & permissions (Phase 2)'),
];

const allKeys = () => PERMISSIONS.map((p) => p.key);
const viewKeys = () =>
  PERMISSIONS.filter((p) => p.action === 'view').map((p) => p.key);
const g = (keys: string[], scope: Scope) => keys.map((key) => ({ key, scope }));

// ---------------------------------------------------------------------------
// 2. Role templates (data; editable later via the builder UI)
// ---------------------------------------------------------------------------
const ROLES: {
  name: string;
  nameAr: string;
  description: string;
  isSystem?: boolean;
}[] = [
  {
    name: 'Super Admin',
    nameAr: 'مدير النظام الأعلى',
    description: 'Full system access; users, settings, overrides.',
    isSystem: true,
  },
  {
    name: 'Executive',
    nameAr: 'تنفيذي',
    description:
      'CEO / Chairman / Exec Dir: read-all, top-tier approvals, licence override.',
  },
  {
    name: 'Sales Manager',
    nameAr: 'مدير المبيعات',
    description: 'Sales oversight, mid-tier approvals, pricing policy.',
  },
  {
    name: 'Sales Rep',
    nameAr: 'مندوب مبيعات',
    description:
      'Owns own leads, clients, pipeline, RFQ requests and quote dispatch.',
  },
  {
    name: 'Engineer',
    nameAr: 'مهندس',
    description:
      'Prices own-department RFQ sections; runs own-department project work.',
  },
  {
    name: 'Technical Director',
    nameAr: 'مدير فني (PMO)',
    description:
      'Engineer powers across all technical departments + department management.',
  },
  {
    name: 'Finance Officer',
    nameAr: 'محاسب',
    description:
      'Payment validation, invoicing, closure gates, finance reports.',
  },
  {
    name: 'Viewer',
    nameAr: 'مشاهدة فقط',
    description: 'Read-only access to allowed surfaces.',
  },
];

function resolveGrants(roleName: string): { key: string; scope: Scope }[] {
  switch (roleName) {
    case 'Super Admin':
      return g(allKeys(), 'ALL');
    case 'Executive':
      return [
        ...g(viewKeys(), 'ALL'),
        ...g(
          ['quote:approve', 'project:licence_override', 'reports:export'],
          'ALL',
        ),
      ];
    case 'Sales Manager':
      return g(
        [
          'leads:view',
          'leads:create',
          'leads:edit',
          'clients:view',
          'clients:create',
          'clients:edit',
          'comms:view',
          'comms:log',
          'pipeline:view',
          'pipeline:move',
          'pipeline:log_visit',
          'rfq:view',
          'rfq:request',
          'quote:view',
          'quote:build',
          'quote:approve',
          'quote:send',
          'quote:set_outcome',
          'reports:view',
          'reports:export',
          'settings:view',
          'settings:manage_pricing_policy',
        ],
        'ALL',
      );
    case 'Sales Rep':
      return g(
        [
          'leads:view',
          'leads:create',
          'leads:edit',
          'clients:view',
          'clients:create',
          'clients:edit',
          'comms:view',
          'comms:log',
          'pipeline:view',
          'pipeline:move',
          'pipeline:log_visit',
          'rfq:view',
          'rfq:request',
          'quote:view',
          'quote:send',
          'quote:set_outcome',
          'reports:view',
        ],
        'OWN',
      );
    case 'Engineer':
      return g(
        [
          'rfq:view',
          'rfq:price_section',
          'rfq:request_docs',
          'quote:view',
          'quote:build',
          'quote:submit_approval',
          'project:view',
          'project:manage_tasks',
          'project:manage_licences',
          'clients:view',
          'reports:view',
        ],
        'DEPARTMENT',
      );
    case 'Technical Director':
      return [
        ...g(
          [
            'rfq:view',
            'rfq:request_docs',
            'rfq:price_section',
            'rfq:assign_pricers',
            'rfq:set_lead_pricer',
            'quote:view',
            'quote:build',
            'quote:submit_approval',
            'project:view',
            'project:convert',
            'project:manage_tasks',
            'project:manage_licences',
            'clients:view',
            'reports:view',
            'reports:export',
          ],
          'ALL',
        ),
        ...g(['departments:view', 'departments:manage'], 'ALL'),
      ];
    case 'Finance Officer':
      return g(
        [
          'finance:view',
          'finance:validate_payment',
          'finance:manage_invoice',
          'finance:closure_gate',
          'quote:view',
          'reports:view',
          'reports:export',
        ],
        'ALL',
      );
    case 'Viewer':
      return g(viewKeys(), 'ALL');
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 3. Departments (11 real + 2 inactive). managerEmail must be a member.
// ---------------------------------------------------------------------------
const DEPARTMENTS: {
  name: string;
  nameAr: string;
  type: DeptType;
  isActive: boolean;
  order: number;
  managerEmail?: string;
}[] = [
  {
    name: 'Executive',
    nameAr: 'الإدارة التنفيذية',
    type: 'EXECUTIVE',
    isActive: true,
    order: 1,
  },
  {
    name: 'Architecture',
    nameAr: 'القسم المعماري',
    type: 'TECHNICAL',
    isActive: true,
    order: 2,
    managerEmail: 'hassan@abak.com.sa',
  },
  {
    name: 'Surveying',
    nameAr: 'قسم المساحة',
    type: 'TECHNICAL',
    isActive: true,
    order: 3,
    managerEmail: 'alaa.ahmed@abak.com.sa',
  },
  {
    name: 'Supervision & Civil',
    nameAr: 'قسم الإشراف والهندسة المدنية',
    type: 'TECHNICAL',
    isActive: true,
    order: 4,
    managerEmail: 'ameen@abak.com.sa',
  },
  {
    name: 'Safety & Industrial Security',
    nameAr: 'قسم السلامة والأمن الصناعي',
    type: 'TECHNICAL',
    isActive: true,
    order: 5,
    managerEmail: 'omar@abak.com.sa',
  },
  {
    name: 'Environmental Services',
    nameAr: 'إدارة الخدمات البيئية',
    type: 'TECHNICAL',
    isActive: true,
    order: 6,
    managerEmail: 'akram@abak.com.sa',
  },
  {
    name: 'Sales & Marketing',
    nameAr: 'قسم التسويق والمبيعات',
    type: 'SALES',
    isActive: true,
    order: 7,
    managerEmail: 'haitham@abak.com.sa',
  },
  {
    name: 'Finance',
    nameAr: 'الإدارة المالية',
    type: 'FINANCE',
    isActive: true,
    order: 8,
    managerEmail: 'accounting@abak.com.sa',
  },
  {
    name: 'Human Resources',
    nameAr: 'إدارة الموارد البشرية',
    type: 'HR',
    isActive: true,
    order: 9,
    managerEmail: 'hr@abak.com.sa',
  },
  {
    name: 'IT',
    nameAr: 'قسم تقنية المعلومات',
    type: 'SUPPORT',
    isActive: true,
    order: 10,
    managerEmail: 'abdullah.mohsen@abak.com.sa',
  },
  {
    name: 'Haya Mudun',
    nameAr: 'قسم هيئة مدن',
    type: 'TECHNICAL',
    isActive: false,
    order: 11,
  },
  {
    name: 'Khibrah Platform',
    nameAr: 'قسم منصة خبرة',
    type: 'TECHNICAL',
    isActive: false,
    order: 12,
  },
];

// ---------------------------------------------------------------------------
// 4. The 25 users → department + role template(s)  (design §8)
// ---------------------------------------------------------------------------
const ASSIGNMENTS: { email: string; department: string; roles: string[] }[] = [
  { email: 'info@abak.com.sa', department: 'Executive', roles: ['Viewer'] },
  {
    email: 'abdullah.mohsen@abak.com.sa',
    department: 'IT',
    roles: ['Super Admin'],
  },
  {
    email: 'mesfer@abak.com.sa',
    department: 'Executive',
    roles: ['Executive'],
  },
  {
    email: 'm.alayaf@abak.com.sa',
    department: 'Executive',
    roles: ['Executive'],
  },
  {
    email: 'salshehri@abak.com.sa',
    department: 'Executive',
    roles: ['Executive'],
  },
  {
    email: 'hassan@abak.com.sa',
    department: 'Architecture',
    roles: ['Engineer', 'Technical Director'],
  },
  {
    email: 'abdulghani.almuwafiq@abak.com.sa',
    department: 'Architecture',
    roles: ['Engineer'],
  },
  {
    email: 'a.albittar@abak.com.sa',
    department: 'Architecture',
    roles: ['Engineer'],
  },
  {
    email: 'hashim.ali@abak.com.sa',
    department: 'Architecture',
    roles: ['Engineer'],
  },
  {
    email: 'khaled@abak.com.sa',
    department: 'Architecture',
    roles: ['Engineer'],
  },
  {
    email: 'osamah.alsamet@abak.com.sa',
    department: 'Architecture',
    roles: ['Engineer'],
  },
  {
    email: 'alaa.ahmed@abak.com.sa',
    department: 'Surveying',
    roles: ['Engineer'],
  },
  {
    email: 'mohammed.deifallah@abak.com.sa',
    department: 'Surveying',
    roles: ['Engineer'],
  },
  {
    email: 'ameen@abak.com.sa',
    department: 'Supervision & Civil',
    roles: ['Engineer'],
  },
  {
    email: 'omar@abak.com.sa',
    department: 'Safety & Industrial Security',
    roles: ['Engineer'],
  },
  {
    email: 'w.abid@abak.com.sa',
    department: 'Safety & Industrial Security',
    roles: ['Engineer'],
  },
  {
    email: 'akram@abak.com.sa',
    department: 'Environmental Services',
    roles: ['Engineer'],
  },
  {
    email: 'haitham@abak.com.sa',
    department: 'Sales & Marketing',
    roles: ['Sales Manager'],
  },
  {
    email: 'ghadah@abak.com.sa',
    department: 'Sales & Marketing',
    roles: ['Sales Rep'],
  },
  {
    email: 'mostafa@abak.com.sa',
    department: 'Sales & Marketing',
    roles: ['Sales Rep'],
  },
  {
    email: 'salwa@abak.com.sa',
    department: 'Sales & Marketing',
    roles: ['Sales Rep'],
  },
  {
    email: 'client.relations1@abak.com.sa',
    department: 'Sales & Marketing',
    roles: ['Sales Rep'],
  },
  {
    email: 'client.relations2@abak.com.sa',
    department: 'Sales & Marketing',
    roles: ['Sales Rep'],
  },
  {
    email: 'accounting@abak.com.sa',
    department: 'Finance',
    roles: ['Finance Officer'],
  },
  { email: 'hr@abak.com.sa', department: 'Human Resources', roles: ['Viewer'] },
];

async function main() {
  // 1. permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: {
        module: p.module,
        action: p.action,
        scopeable: p.scopeable,
        description: p.description,
      },
    });
  }
  const permByKey = Object.fromEntries(
    (await prisma.permission.findMany()).map((p) => [p.key, p.id]),
  );

  // 2. roles + role-permissions (rebuild grants each run)
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      create: {
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        isSystem: !!r.isSystem,
      },
      update: {
        nameAr: r.nameAr,
        description: r.description,
        isSystem: !!r.isSystem,
      },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const grants = resolveGrants(r.name)
      .filter((gr) => permByKey[gr.key])
      .map((gr) => ({
        roleId: role.id,
        permissionId: permByKey[gr.key],
        scope: gr.scope as any,
      }));
    await prisma.rolePermission.createMany({
      data: grants,
      skipDuplicates: true,
    });
  }
  const roleByName = Object.fromEntries(
    (await prisma.role.findMany()).map((r) => [r.name, r.id]),
  );

  // 3. departments (without managers first)
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: d.name },
      create: {
        name: d.name,
        nameAr: d.nameAr,
        type: d.type as any,
        isActive: d.isActive,
        order: d.order,
      },
      update: {
        nameAr: d.nameAr,
        type: d.type as any,
        isActive: d.isActive,
        order: d.order,
      },
    });
  }
  const deptByName = Object.fromEntries(
    (await prisma.department.findMany()).map((d) => [d.name, d.id]),
  );

  // 4. user department + role assignments
  for (const a of ASSIGNMENTS) {
    const user = await prisma.user.findUnique({ where: { email: a.email } });
    if (!user) {
      console.warn(
        `! user not found (run seed-abak-real-users first): ${a.email}`,
      );
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { departmentId: deptByName[a.department] },
    });
    for (const roleName of a.roles) {
      const roleId = roleByName[roleName];
      if (!roleId) {
        console.warn(`! role not found: ${roleName}`);
        continue;
      }
      await prisma.roleAssignment.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        create: { userId: user.id, roleId },
        update: {},
      });
    }
  }

  // 5. department managers (each must already be a member of the department)
  for (const d of DEPARTMENTS) {
    if (!d.managerEmail) continue;
    const mgr = await prisma.user.findUnique({
      where: { email: d.managerEmail },
    });
    if (!mgr) {
      console.warn(`! manager not found: ${d.managerEmail}`);
      continue;
    }
    await prisma.department.update({
      where: { name: d.name },
      data: { managerId: mgr.id },
    });
  }

  console.log(
    `RBAC seed complete — ${PERMISSIONS.length} permissions, ${ROLES.length} roles, ${DEPARTMENTS.length} departments, ${ASSIGNMENTS.length} user assignments.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
