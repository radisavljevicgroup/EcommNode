// Every business-data route needs to know which company is calling before
// it touches any store — without this, every route was reading/writing one
// shared global dataset with no isolation between different registered
// accounts (fixed 2026-09-03: a second real account could see the first
// company's WooCommerce/Eurocom/orders data). Mirrors the check
// routes/workers.js already did for its own endpoints.
//
// Scoped by `users.firma_id`, a real FK into `firme` (see
// supabase-firme-refactor-migration.sql) — not the account's own pib
// (pib is public information: invoices, APR registry, a weak thing to
// build isolation on) and not the old bare `token` UUID it replaces
// (same scoping job, but token had no table behind it). Kept on req as
// `req.company`, not `req.firmaId`, so the 15+ existing routes that
// already read req.company didn't need to change for this migration.
// It can only be set by the signup trigger (new company) or the
// admin-privileged worker-invite flow (server/routes/workers.js), never
// by the account holder directly — see the firma_id revoke in that SQL
// file.
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { getSupabaseAdmin } = require("./supabaseAdmin");

// supabaseAdmin.auth.getUser(token) verifies the token by asking Supabase's
// Auth server over the network — a real HTTP round-trip on every single
// request, which is the dominant cost when a page fires several requests
// at once (Integracije: 6 in parallel). This project's tokens are signed
// with an asymmetric key (ES256), so the signature can instead be checked
// locally against Supabase's published JWKS — same signature, same
// issuer/expiry checks, no less secure, just no network hop. `jose`
// fetches and caches the key set itself (and re-fetches on a `kid` it
// doesn't recognize, e.g. after key rotation).
// Built lazily, not at module load — this file is required (transitively,
// via routes/inbox.js) before index.js calls dotenv.config(), so
// process.env.SUPABASE_URL isn't populated yet at require-time. Mirrors
// getSupabaseAdmin()'s existing lazy-cached pattern below.
let jwks;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
    );
  }
  return jwks;
}

// firma_id doesn't change for the lifetime of a session, so a short cache
// avoids re-querying it on every one of those parallel requests too —
// only the first pays the DB round-trip, the rest hit memory.
const FIRMA_ID_CACHE_TTL_MS = 60_000;
const firmaIdCache = new Map(); // userId -> { firmaId, expiresAt }

async function requireAuth(req, res, next) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase servisni ključ nije podešen na serveru." });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Niste prijavljeni." });
  }

  let userId;
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    });
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: "Niste prijavljeni." });
  }

  const cached = firmaIdCache.get(userId);
  let firmaId;
  if (cached && cached.expiresAt > Date.now()) {
    firmaId = cached.firmaId;
  } else {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("firma_id")
      .eq("id", userId)
      .single();
    if (profileError || !profile) {
      return res.status(403).json({ error: "Nalog nije pronađen." });
    }
    firmaId = profile.firma_id;
    firmaIdCache.set(userId, { firmaId, expiresAt: Date.now() + FIRMA_ID_CACHE_TTL_MS });
  }

  req.userId = userId;
  req.company = firmaId;
  next();
}

// Only these module keys (server/premium/<key>) are gated by
// firme.enabled_premium_modules — a premium folder NOT listed here (e.g.
// vip-analytics, alerts) stays open to every company, same as before this
// restriction existed at all. Add a module's folder name here only when
// it's built for one specific client (like Eurocom's distributor
// integration) and shouldn't show up for anyone else — most premium
// modules are general-purpose add-ons any company can turn on for
// themselves (see enabledPremiumTools in settings.json for that,
// unrelated, per-company on/off toggle) and don't belong on this list.
const RESTRICTED_PREMIUM_MODULES = new Set(["eurocom"]);

// Gates a premium module's routes (server/premium/<moduleKey>/index.js) to
// only the firme entitled to it, but only for modules in
// RESTRICTED_PREMIUM_MODULES — see supabase-premium-module-access-
// migration.sql. moduleKey is the folder name, applied per-router in
// index.js's premium-mounting loop.
function requirePremiumModule(moduleKey) {
  return async function requirePremiumModuleMiddleware(req, res, next) {
    if (!RESTRICTED_PREMIUM_MODULES.has(moduleKey)) return next();

    // Every premium module is mounted at the same shared "/api" prefix
    // (see index.js), so this middleware runs for EVERY /api/* request
    // that reaches it, not just this module's own — Express falls
    // through unmatched routers to the next app.use() in line. Every
    // module's routes live under /api/<folder-name>/... by convention
    // (e.g. /eurocom/status, /vip-analytics/abc), so without this check
    // a restricted module mounted before an unrestricted one would 403
    // requests that were never meant for it, before they ever reach
    // their real router.
    if (!req.path.startsWith(`/${moduleKey}`)) return next();

    const supabaseAdmin = getSupabaseAdmin();
    const { data: firma, error } = await supabaseAdmin
      .from("firme")
      .select("enabled_premium_modules")
      .eq("id", req.company)
      .single();

    if (error || !firma?.enabled_premium_modules?.includes(moduleKey)) {
      return res.status(403).json({ error: "Ova funkcionalnost nije uključena za tvoju firmu." });
    }
    next();
  };
}

module.exports = { requireAuth, requirePremiumModule };
