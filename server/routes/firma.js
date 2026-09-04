const { Router } = require("express");
const { getSupabaseAdmin } = require("../lib/supabaseAdmin");

const router = Router();

// Same manager-level set workers.js gates worker management behind — firma
// naziv is the same class of company-wide setting as adding a worker, not
// a personal-profile edit.
const CAN_EDIT_FIRMA = new Set(["E-commerce Manager", "E-commerce Operations Manager", "CEO"]);

router.get("/firma", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("firme")
    .select("id, pib, naziv, enabled_premium_modules")
    .eq("id", req.company)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Firma nije pronađena." });
  }

  res.json({
    firma: {
      id: data.id,
      pib: data.pib,
      naziv: data.naziv,
      enabledPremiumModules: data.enabled_premium_modules || [],
    },
  });
});

router.put("/firma", async (req, res) => {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("roles(name)")
    .eq("id", req.userId)
    .single();

  if (profileError || !CAN_EDIT_FIRMA.has(profile?.roles?.name)) {
    return res.status(403).json({ error: "Nemate dozvolu za izmenu podataka firme." });
  }

  const { naziv } = req.body || {};
  if (!naziv?.trim()) {
    return res.status(400).json({ error: "Naziv firme je obavezan." });
  }

  // pib is deliberately not accepted here at all — it's locked at the DB
  // grant level too (see supabase-firme-refactor-migration.sql step 7),
  // this is just the app-level mirror of that so the error is a normal
  // 400 instead of a raw Postgres permission-denied.
  const { error } = await supabaseAdmin
    .from("firme")
    .update({ naziv: naziv.trim() })
    .eq("id", req.company);

  if (error) {
    return res.status(400).json({ error: "Nije moguće sačuvati izmene." });
  }

  res.json({ firma: { id: req.company, naziv: naziv.trim() } });
});

module.exports = router;
