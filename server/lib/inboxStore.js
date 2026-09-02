const crypto = require("crypto");
const { getSupabaseAdmin } = require("./supabaseAdmin");

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Supabase nije podešen. Postavi SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY u server/.env."
    );
  }
  return supabase;
}

// `enrich` is an optional async () => { senderAvatarUrl, accountLabel }
// callback — only invoked when a new conversation is actually being
// created, so the Graph API profile/account lookups it does don't run
// again on every inbound message in an existing thread.
async function getOrCreateConversation({ platform, senderId, senderName, pageId, enrich }) {
  const supabase = requireSupabase();

  // PostgREST's .eq() can't match NULL (SQL's `= null` is never true) — a
  // missing pageId has to go through .is() instead, or every connection
  // without one would fail to find its own conversation on the next lookup.
  let query = supabase.from("inbox_conversations").select("*").eq("platform", platform).eq("sender_id", senderId);
  query = pageId ? query.eq("page_id", pageId) : query.is("page_id", null);
  const { data: existing, error: findErr } = await query.maybeSingle();
  if (findErr) throw findErr;
  if (existing) return existing;

  let extra = {};
  if (enrich) {
    try {
      extra = (await enrich()) || {};
    } catch {
      extra = {};
    }
  }

  const { data: created, error: insertErr } = await supabase
    .from("inbox_conversations")
    .insert({
      platform,
      sender_id: senderId,
      // A name already present in the webhook payload (WhatsApp's contact
      // profile) is immediate and reliable — only fall back to the
      // Graph API lookup `enrich` did when the payload didn't have one
      // (Messenger/Instagram never include it).
      sender_name: senderName || extra.senderName || null,
      page_id: pageId || null,
      sender_avatar_url: extra.senderAvatarUrl || null,
      account_label: extra.accountLabel || null,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;
  return created;
}

// Inbound messages are inserted idempotently — Meta retries webhook
// deliveries that don't get a fast 200, and the unique (platform,
// message_id) constraint means a retried delivery is silently ignored
// instead of duplicating the message in the thread.
async function saveInboundMessage({ conversation, message }) {
  const supabase = requireSupabase();

  const { error: insertErr } = await supabase
    .from("inbox_messages")
    .upsert(
      {
        conversation_id: conversation.id,
        message_id: message.messageId,
        platform: message.platform,
        direction: "inbound",
        sender_id: message.senderId,
        sender_name: message.senderName || conversation.sender_name || null,
        text: message.text,
        status: "received",
        created_at: message.timestamp,
      },
      { onConflict: "platform,message_id", ignoreDuplicates: true }
    );
  if (insertErr) throw insertErr;

  const patch = {
    last_message_text: message.text,
    last_message_at: message.timestamp,
    unread_count: (conversation.unread_count || 0) + 1,
  };
  if (message.senderName && !conversation.sender_name) patch.sender_name = message.senderName;

  const { error: updateErr } = await supabase
    .from("inbox_conversations")
    .update(patch)
    .eq("id", conversation.id);
  if (updateErr) throw updateErr;
}

async function saveOutboundMessage({ conversationId, platform, senderId, text, messageId, status }) {
  const supabase = requireSupabase();
  const now = new Date().toISOString();

  const { data, error: insertErr } = await supabase
    .from("inbox_messages")
    .insert({
      conversation_id: conversationId,
      message_id: messageId || `local-${crypto.randomUUID()}`,
      platform,
      direction: "outbound",
      sender_id: senderId,
      text,
      status,
      created_at: now,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;

  const { error: updateErr } = await supabase
    .from("inbox_conversations")
    .update({ last_message_text: text, last_message_at: now })
    .eq("id", conversationId);
  if (updateErr) throw updateErr;

  return data;
}

async function updateMessageStatus(platform, messageId, status) {
  const supabase = requireSupabase();
  await supabase
    .from("inbox_messages")
    .update({ status })
    .eq("platform", platform)
    .eq("message_id", messageId);
}

async function listConversations() {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("inbox_conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data;
}

async function getConversation(id) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("inbox_conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function listMessages(conversationId) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("inbox_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

async function markConversationRead(conversationId) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("inbox_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
  if (error) throw error;
}

module.exports = {
  getOrCreateConversation,
  saveInboundMessage,
  saveOutboundMessage,
  updateMessageStatus,
  listConversations,
  getConversation,
  listMessages,
  markConversationRead,
};
