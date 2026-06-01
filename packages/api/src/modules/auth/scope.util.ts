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
