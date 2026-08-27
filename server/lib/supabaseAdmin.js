const { createClient } = require("@supabase/supabase-js");

let cachedClient;

function getSupabaseAdmin() {
  if (cachedClient !== undefined) return cachedClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cachedClient =
    supabaseUrl && supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  return cachedClient;
}

module.exports = { getSupabaseAdmin };
