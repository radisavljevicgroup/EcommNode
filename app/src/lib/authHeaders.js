import { supabase } from "./supabaseClient";

// Every backend route now checks who's calling (see server/lib/auth.js) and
// scopes data to that account's company — without the current session's
// access token attached, every request would just get a 401.
export async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}
