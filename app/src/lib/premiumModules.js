import { useEffect, useState } from "react";
import { fetchFirma } from "../api/firma";
import { retryable } from "./fetchWithRetry";

// Every premium module's glob key looks like "../../premium/eurocom/index.jsx"
// — the folder name is the module's key, matching the same name the
// server keys firme.enabled_premium_modules by (see server/lib/auth.js's
// requirePremiumModule and supabase-premium-module-access-migration.sql).
// One place to parse it out so every glob site (integrations, IT infra,
// analytics tabs) agrees on what a module's "key" is.
export function moduleKeyFromGlobPath(globPath) {
  const match = /\/premium\/([^/]+)\//.exec(globPath);
  return match ? match[1] : null;
}

// Must mirror server/lib/auth.js's RESTRICTED_PREMIUM_MODULES exactly —
// only these module keys are gated by firme.enabled_premium_modules. A
// module NOT listed here (e.g. vip-analytics, alerts) always renders,
// same as before this restriction existed. Most premium modules are
// general-purpose add-ons any company can turn on for themselves (see
// enabledPremiumTools in settings.json, an unrelated per-company toggle)
// and don't belong on this list — add a key here only when that module is
// built for one specific client and shouldn't show up for anyone else.
const RESTRICTED_PREMIUM_MODULES = new Set(["eurocom"]);

// Keeps only the glob-loaded [path, module] entries this firma is allowed
// to see — modules not in RESTRICTED_PREMIUM_MODULES always pass through
// regardless of enabledPremiumModules. Same shape as
// Object.entries(globModules), just filtered, so call sites map over it
// exactly like before.
export function filterEntitledModules(globModules, enabledPremiumModules) {
  return Object.entries(globModules).filter(([globPath]) => {
    const key = moduleKeyFromGlobPath(globPath);
    return !RESTRICTED_PREMIUM_MODULES.has(key) || enabledPremiumModules.includes(key);
  });
}

// A failed fetchFirma() (dev server mid-restart, a dropped connection, any
// transient network blip) used to be swallowed silently, permanently
// leaving enabledPremiumModules at its empty default — indistinguishable
// from "not entitled", so a restricted module (Eurocom) would stay hidden
// for that entire page view with no way to recover short of a manual
// reload. retryable() (see lib/fetchWithRetry) retries with backoff first.
const fetchFirmaWithRetry = retryable(fetchFirma);

export function useEnabledPremiumModules() {
  const [enabledPremiumModules, setEnabledPremiumModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFirmaWithRetry()
      .then(({ firma }) => {
        if (!cancelled) setEnabledPremiumModules(firma.enabledPremiumModules || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabledPremiumModules, loading };
}
