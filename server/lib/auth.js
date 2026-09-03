// Every business-data route needs to know which company is calling before
// it touches any store — without this, every route was reading/writing one
// shared global dataset with no isolation between different registered
// accounts (fixed 2026-09-03: a second real account could see the first
// company's WooCommerce/Eurocom/orders data). Mirrors the check
// routes/workers.js already did for its own endpoints.
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
    .select("company")
    .eq("id", callerData.user.id)
    .single();
  if (profileError || !profile) {
    return res.status(403).json({ error: "Nalog nije pronađen." });
  }

  req.userId = callerData.user.id;
  // Kept as whatever's on the profile (including null/"") rather than
  // defaulted to something shared — an account with no company set gets
  // its own empty, isolated data space instead of ever seeing someone
  // else's, and instead of ever being silently merged with another
  // uncofigured account.
  req.company = profile.company;
  next();
}

module.exports = { requireAuth };
