import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// When set, the browser talks to Supabase through our API
// (server/routes/supabaseProxy.js) instead of <project>.supabase.co directly
// — some networks time out on the direct host (login "Failed to fetch",
// 2026-10-27). The session storage key is pinned to the real project URL so
// switching between direct and proxied access doesn't log anyone out
// (supabase-js otherwise derives it from the first label of the URL host).
const proxyUrl = import.meta.env.VITE_SUPABASE_PROXY_URL;
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";

export const supabase = createClient(proxyUrl || supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: `sb-${projectRef}-auth-token` },
});
