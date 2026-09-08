// Role names exactly as stored in Supabase `roles.name` (public.roles table).

// Operater ("E-commerce Operations Manager") and Magacioner ("Warehouse
// worker") only get Porudžbine + Kalendar as nav pills. "Podešavanja" is
// deliberately still reachable (just not shown as a nav pill) so the
// account-menu "Uredi nalog" shortcut keeps working for them.
export const RESTRICTED_ROLES = new Set(["E-commerce Operations Manager", "Warehouse worker"]);
export const RESTRICTED_NAV_ROUTES = new Set(["porudzbine", "kalendar"]);
export const RESTRICTED_ALLOWED_ROUTES = new Set(["home", "porudzbine", "kalendar", "podesavanja"]);

// Roles whose "Početna" has no dashboard built for them yet.
export const EMPTY_HOME_ROLES = new Set([
  "IT Administrator",
  "Marketing Manager",
  ...RESTRICTED_ROLES,
]);

// Nav routes hidden for one specific (non-restricted) role, on top of the
// restricted-role rules above.
export const ROLE_HIDDEN_ROUTES = {
  "Marketing Manager": new Set(["it-infrastruktura"]),
};

export function isRouteAllowed(roleName, route) {
  if (RESTRICTED_ROLES.has(roleName)) return RESTRICTED_ALLOWED_ROUTES.has(route);
  return !ROLE_HIDDEN_ROUTES[roleName]?.has(route);
}
