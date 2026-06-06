/**
 * Canonical route → required-permission map (the frontend trust boundary).
 *
 * The backend independently enforces every endpoint; this map exists so the UI
 * stops *rendering the module shell* for users who can't use it. Each entry is a
 * locale-stripped pathname prefix mapped to the permission a user must hold to
 * see that route. The guard (see `route-guard.tsx`) resolves the *longest*
 * matching prefix so a more specific route (e.g. `/clients/new`) can require a
 * stronger permission than its parent (`/clients`).
 *
 * Keys mirror the API's `@RequirePermission(...)` decorators and the sidebar's
 * `perm` fields, so the sidebar, the route guard, and the API all agree on what
 * "access" means for a given module.
 *
 * A route NOT listed here is treated as open to any authenticated user
 * (dashboard home, profile, settings/profile, notifications, etc.). Only add a
 * route when there is a real permission to gate it on.
 */
export interface RouteRule {
  /** Locale-stripped path prefix, e.g. `/admin/employees`. */
  prefix: string;
  /** Permission(s) required. Holding ANY one of them grants the route. */
  anyOf: string[];
}

// Order does not matter — resolution always picks the longest matching prefix.
export const ROUTE_PERMISSIONS: RouteRule[] = [
  // ── Admin (read-gated; the pages themselves gate write actions) ──────────
  { prefix: '/admin/employees', anyOf: ['users:view'] },
  { prefix: '/admin/roles', anyOf: ['roles:view'] },
  { prefix: '/admin/departments', anyOf: ['departments:view'] },
  { prefix: '/admin/services', anyOf: ['services:view', 'services:manage'] },
  {
    prefix: '/admin/pricing-policy',
    anyOf: ['settings:manage_pricing_policy'],
  },
  { prefix: '/admin/holidays', anyOf: ['settings:manage_holidays'] },
  { prefix: '/admin/settings', anyOf: ['settings:view', 'settings:manage'] },
  { prefix: '/admin/audit', anyOf: ['audit:view'] },
  // Bare `/admin` (any landing) — needs at least one admin read perm.
  {
    prefix: '/admin',
    anyOf: [
      'users:view',
      'roles:view',
      'departments:view',
      'services:view',
      'settings:view',
      'audit:view',
      'settings:manage_pricing_policy',
      'settings:manage_holidays',
    ],
  },

  // ── Sales / pipeline ────────────────────────────────────────────────────
  // /leads/new must require create — a read-only viewer (leads:view only) must
  // NOT reach a working create form (R2-6). Longest-prefix wins over /leads.
  { prefix: '/leads/new', anyOf: ['leads:create'] },
  { prefix: '/leads', anyOf: ['leads:view'] },
  // /clients/new must require create — a read-only viewer (clients:view only)
  // must NOT reach a working create form. Longest-prefix wins over /clients.
  { prefix: '/clients/new', anyOf: ['clients:create'] },
  { prefix: '/clients', anyOf: ['clients:view'] },
  { prefix: '/pipeline', anyOf: ['pipeline:view'] },
  { prefix: '/rfqs', anyOf: ['rfq:view'] },
  // /quotes/new must require build — a view-only user (quote:view only, e.g.
  // Viewer / Finance Officer) must NOT reach a working quote builder (R2-6).
  { prefix: '/quotes/new', anyOf: ['quote:build'] },
  { prefix: '/quotes', anyOf: ['quote:view'] },

  // ── Delivery ────────────────────────────────────────────────────────────
  { prefix: '/projects', anyOf: ['project:view'] },
  { prefix: '/finance', anyOf: ['finance:view'] },
  { prefix: '/gov-transactions', anyOf: ['gov:view'] },

  // ── Insight ─────────────────────────────────────────────────────────────
  { prefix: '/reports', anyOf: ['reports:view'] },
  { prefix: '/executive', anyOf: ['reports:view'] },
  { prefix: '/targets', anyOf: ['reports:view', 'pipeline:view'] },
  { prefix: '/pro', anyOf: ['gov:view', 'gov:manage'] },
];

/**
 * Strip a leading locale segment (`/ar`, `/en`) from a pathname so route rules
 * match regardless of the active locale. `next-intl`'s `usePathname` already
 * returns the locale-less path, but middleware/server contexts see the raw one,
 * so this is defensive on both sides.
 */
export function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(ar|en)(?=\/|$)/);
  const stripped = m ? pathname.slice(m[0].length) : pathname;
  return stripped === '' ? '/' : stripped;
}

/**
 * Resolve the permission rule guarding a pathname, picking the longest matching
 * prefix (so `/clients/new` beats `/clients`). Returns `null` when no rule
 * applies — i.e. the route is open to any authenticated user.
 */
export function ruleForPath(pathname: string): RouteRule | null {
  const path = stripLocale(pathname);
  let best: RouteRule | null = null;
  for (const rule of ROUTE_PERMISSIONS) {
    const matches = path === rule.prefix || path.startsWith(`${rule.prefix}/`);
    if (matches && (!best || rule.prefix.length > best.prefix.length)) {
      best = rule;
    }
  }
  return best;
}
