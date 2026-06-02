/**
 * Row-level data-scope helpers for the permission model.
 * The PermissionGuard resolves a scope (OWN | DEPARTMENT | ALL) per permission
 * key onto `request.permissionScopes`; services use these helpers to translate
 * that scope into a Prisma `where` fragment.
 */
export type PermissionScope = 'OWN' | 'DEPARTMENT' | 'ALL';

/** Shape of the authenticated user as attached by JwtStrategy. */
export interface ScopeUser {
  id: string;
  departmentId?: string | null;
  managedDepartment?: { id: string } | null;
}

export interface ScopeContext {
  user: ScopeUser;
  scope?: PermissionScope;
}

/**
 * Owner-scoped entities (leads, clients, quotes) — no department dimension.
 * A non-ALL scope restricts the query to records the user owns.
 * Spread the result into the query's top-level `where`.
 */
export function ownerScopeFilter(
  ctx: ScopeContext | undefined,
  ownerField: string,
): Record<string, string> {
  if (!ctx?.scope || ctx.scope === 'ALL') return {};
  return { [ownerField]: ctx.user.id };
}

/**
 * Department-scoped entities. A department manager (managedDepartment set) sees
 * the whole department; a regular member sees only their own records; ALL sees
 * everything. Returns a where fragment keyed by the given fields.
 */
export function departmentScopeFilter(
  ctx: ScopeContext | undefined,
  fields: { departmentField: string; ownerField: string },
): Record<string, string> {
  if (!ctx?.scope || ctx.scope === 'ALL') return {};
  if (ctx.scope === 'DEPARTMENT') {
    const deptId = ctx.user.managedDepartment?.id ?? ctx.user.departmentId;
    if (deptId) return { [fields.departmentField]: deptId };
  }
  return { [fields.ownerField]: ctx.user.id };
}

/**
 * RFQs are relation-scoped (engineers have no owner column). A non-ALL viewer
 * sees their originated RFQs (OWN, e.g. Sales Rep) or RFQs assigned to them
 * (DEPARTMENT, engineers). Whole-department visibility for managers needs the
 * ServiceCategory<->Department link populated (RfqAssignment.departmentId points
 * at ServiceCategory today) — follow-up.
 */
export function rfqScopeFilter(
  ctx: ScopeContext | undefined,
): Record<string, unknown> {
  if (!ctx?.scope || ctx.scope === 'ALL') return {};
  if (ctx.scope === 'DEPARTMENT') {
    return { assignments: { some: { assigneeId: ctx.user.id } } };
  }
  return { originalSalesRepId: ctx.user.id };
}

/**
 * Projects have no department column. A non-ALL viewer (e.g. Engineer) sees
 * projects they are involved in: PM, a phase owner, or a task assignee.
 * Whole-department visibility for managers is a follow-up.
 */
export function projectScopeFilter(
  ctx: ScopeContext | undefined,
): Record<string, unknown> {
  if (!ctx?.scope || ctx.scope === 'ALL') return {};
  const uid = ctx.user.id;
  const deptId =
    ctx.scope === 'DEPARTMENT' ? ctx.user.managedDepartment?.id : undefined;
  if (deptId) {
    // Department manager: any project their department is working on
    // (PM, a phase owner, or a task assignee belongs to the department).
    return {
      OR: [
        { pm: { departmentId: deptId } },
        { phases: { some: { owner: { departmentId: deptId } } } },
        {
          phases: {
            some: { tasks: { some: { assignee: { departmentId: deptId } } } },
          },
        },
      ],
    };
  }
  // Engineer / non-manager: projects they are personally involved in.
  return {
    OR: [
      { pmId: uid },
      { phases: { some: { ownerId: uid } } },
      { phases: { some: { tasks: { some: { assigneeId: uid } } } } },
    ],
  };
}
