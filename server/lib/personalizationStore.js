// Unlike the other *Store.js files in this folder, this one doesn't wrap a
// local JSON file — the underlying data (order_personalization_files /
// order_personalization_completions) lives in Supabase, shared between
// local and production (see CLAUDE.md's note on why: these are real
// business records tied to a specific order, not a per-machine setting).
const { getSupabaseAdmin } = require("./supabaseAdmin");

function keyOf(connectionId, orderId) {
  return `${connectionId}:${orderId}`;
}

async function getOrderKeysWithFiles(company) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return new Set();
  const { data, error } = await supabaseAdmin
    .from("order_personalization_files")
    .select("connection_id, order_id")
    .eq("firma_id", company);
  if (error || !data) return new Set();
  return new Set(data.map((row) => keyOf(row.connection_id, row.order_id)));
}

async function getCompletedOrderKeys(company) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return new Set();
  const { data, error } = await supabaseAdmin
    .from("order_personalization_completions")
    .select("connection_id, order_id")
    .eq("firma_id", company);
  if (error || !data) return new Set();
  return new Set(data.map((row) => keyOf(row.connection_id, row.order_id)));
}

// An order is "waiting for graviranje" only once it actually has files
// attached — no files yet means the prep isn't ready, so it shouldn't show
// up as pending work (see chat: "Uslov da order uđe u sekciju za
// graviranje je da ima fajlove u sebi").
async function getPendingPersonalizationKeys(company) {
  const [withFiles, completed] = await Promise.all([
    getOrderKeysWithFiles(company),
    getCompletedOrderKeys(company),
  ]);
  return new Set([...withFiles].filter((key) => !completed.has(key)));
}

async function isOrderCompleted(company, connectionId, orderId) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from("order_personalization_completions")
    .select("completed_at")
    .eq("firma_id", company)
    .eq("connection_id", connectionId)
    .eq("order_id", String(orderId))
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

async function markOrderCompleted(company, connectionId, orderId, userId) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Supabase servisni ključ nije podešen na serveru.");
  const { error } = await supabaseAdmin.from("order_personalization_completions").upsert(
    {
      firma_id: company,
      connection_id: connectionId,
      order_id: String(orderId),
      completed_by: userId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "firma_id,connection_id,order_id" }
  );
  if (error) throw new Error("Neuspešno obeležavanje kao izgravirano.");
}

async function unmarkOrderCompleted(company, connectionId, orderId) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error("Supabase servisni ključ nije podešen na serveru.");
  const { error } = await supabaseAdmin
    .from("order_personalization_completions")
    .delete()
    .eq("firma_id", company)
    .eq("connection_id", connectionId)
    .eq("order_id", String(orderId));
  if (error) throw new Error("Neuspešno vraćanje u čekanje.");
}

module.exports = {
  getOrderKeysWithFiles,
  getCompletedOrderKeys,
  getPendingPersonalizationKeys,
  isOrderCompleted,
  markOrderCompleted,
  unmarkOrderCompleted,
};
