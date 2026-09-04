// Every business-data route needs to know which company is calling before
// it touches any store — without this, every route was reading/writing one
// shared global dataset with no isolation between different registered
// accounts (fixed 2026-09-03: a second real account could see the first
// company's WooCommerce/Eurocom/orders data). Mirrors the check
// routes/workers.js already did for its own endpoints.
//
// Scoped by the random per-user `token` column, not the old free-text
// `company` column (fixed 2026-09-04: that column was a plain
// user-editable Settings field, so anyone could type in another
// company's name and see their entire dataset — see
// supabase-pib-unique-migration.sql). token is deliberately NOT the
// account's pib — pib is public information (invoices, APR registry), so
// even locked down from direct writes it's a weaker thing to build
// isolation on than an opaque random value. It can only be set by the
// column default (fresh signup) or the admin-privileged worker-invite
// flow, never by the account holder directly.
const { getSupabaseAdmin } = require("./supabaseAdmin");

async function requireAuth(req, res, next) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Supabase servisni ključ nije podešen na serveru." });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Niste prijavljeni." });
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: "Niste prijavljeni." });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("token")
    .eq("id", callerData.user.id)
    .single();
  if (profileError || !profile) {
    return res.status(403).json({ error: "Nalog nije pronađen." });
  }

  req.userId = callerData.user.id;
  req.company = profile.token;
  next();
}

module.exports = { requireAuth };
