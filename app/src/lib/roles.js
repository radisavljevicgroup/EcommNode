// Role names exactly as stored in Supabase `roles.name` (public.roles table).

// Operater ("E-commerce Operations Manager") and Magacioner ("Warehouse
// worker") only get Porudžbine + Kalendar as nav pills. "Podešavanja" is
// deliberately still reachable (just not shown as a nav pill) so the
// account-menu "Uredi nalog" shortcut keeps working for them.
export const RESTRICTED_ROLES = new Set(["E-commerce Operations Manager", "Warehouse worker"]);
export const RESTRICTED_NAV_ROUTES = new Set(["porudzbine", "kalendar"]);
export const RESTRICTED_ALLOWED_ROUTES = new Set(["home", "porudzbine", "kalendar", "podesavanja"]);

// Roles whose "Početna" has no dashboard built for them yet.
export const EMPTY_HOME_ROLES = new Set();

// Gets the manager-specific "Početna" (ManagerHome.jsx) instead of the
// generic Dashboard.jsx — see App.jsx's route switch. Marketing Manager
// gets the exact same dashboard as E-commerce Manager (same component, no
// role-specific trimming) — it's still nav-restricted away from IT
// Infrastruktura (see ROLE_HIDDEN_ROUTES below), just not on this page.
export const MANAGER_HOME_ROLES = new Set(["E-commerce Manager", "Marketing Manager"]);

// Gets the IT-facing "Početna" (ItAdminHome.jsx) — order KPIs plus the
// Eurocom/Kontrola zaliha status widgets, matching this role's nav being
// limited to IT Infrastruktura.
export const IT_ADMIN_HOME_ROLES = new Set(["IT Administrator"]);

// Gets the trimmed-down "Početna" (RestrictedHome.jsx) — same nav
// restriction as RESTRICTED_ROLES above, but they still get a real
// dashboard, just a small fixed subset of one. The value picks which
// second chart RestrictedHome shows (see that file's own comment for why
// they differ per role).
export const RESTRICTED_HOME_ROLES = {
  "E-commerce Operations Manager": "yoy",
  "Warehouse worker": "geo",
};

// Nav routes hidden for one specific (non-restricted) role, on top of the
// restricted-role rules above.
export const ROLE_HIDDEN_ROUTES = {
  "Marketing Manager": new Set(["it-infrastruktura"]),
};

export function isRouteAllowed(roleName, route) {
  if (RESTRICTED_ROLES.has(roleName)) return RESTRICTED_ALLOWED_ROUTES.has(route);
  return !ROLE_HIDDEN_ROUTES[roleName]?.has(route);
}
