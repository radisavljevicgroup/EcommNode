const crypto = require("crypto");

const GRAPH_API_VERSION = "v18.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Meta signs every webhook POST body (Messenger, Instagram, and WhatsApp
// alike) with the app secret via X-Hub-Signature-256: "sha256=<hmac>".
// Comparing with a fixed-length buffer (timingSafeEqual) avoids leaking the
// expected signature through response-time differences.
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return true; // not configured — caller decides whether to allow through
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function graphFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Meta API greška (HTTP ${res.status}).`);
    err.status = data.error?.code === 190 ? 401 : res.status;
    throw err;
  }
  return data;
}

// --- Facebook Login for the "Poveži se sa Facebook-om" connect flow -----
// Replaces the old "paste a Page Access Token you found in Graph API
// Explorer" modal, which was never something a non-developer merchant
// could realistically do on their own. The frontend gets a short-lived
// USER token from FB.login() (see lib/facebookSdk.js); these two calls
// turn that into the actual Page Access Tokens (+ linked Instagram
// account ids) the rest of this file/routes/inbox.js already expects —
// nothing downstream of "we have a page id + access token" changes.

// A user token from FB.login() is short-lived (~1-2h) — pages/access
// tokens minted from a LONG-lived user token effectively never expire
// (until the merchant revokes access), which is what we need to store and
// reuse for sending messages indefinitely. This is the standard Meta
// "token exchange" step, not something FB.login() does on its own.
async function exchangeForLongLivedUserToken(shortLivedUserToken) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID/META_APP_SECRET nisu podešeni na serveru.");
  }
  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedUserToken);
  const data = await graphFetch(url.toString());
  return data.access_token;
}

// Every Page the merchant manages, each with its own (already long-lived,
// since it's minted from a long-lived user token) Page Access Token, plus
// the linked Instagram professional account if there is one — exactly the
// {id, name, accessToken, instagram} shape the frontend page-picker needs
// to call POST /inbox/connections with, for either platform, no further
// lookups required.
async function listManagedPages(longLivedUserToken) {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  url.searchParams.set("access_token", longLivedUserToken);
  const data = await graphFetch(url.toString());
  return (data.data || []).map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagram: page.instagram_business_account
      ? { id: page.instagram_business_account.id, username: page.instagram_business_account.username }
      : null,
  }));
}

// Meta requires each Page (Instagram professional accounts message through
// their linked Page too, so this covers both) to be explicitly subscribed
// to our app's webhook, on top of the app-level webhook URL already
// configured in the Meta App Dashboard. Skipping this call is invisible —
// saving the connection "succeeds" and the Page shows as connected, but
// Meta silently never sends any messaging events for it, so nothing ever
// shows up in Poruke. Mirrors Viber's own explicit setWebhook() call below
// in routes/inbox.js — same idea, this is Meta's equivalent.
async function subscribePage(pageAccessToken, pageId) {
  const url = new URL(`${GRAPH_API_BASE}/${pageId}/subscribed_apps`);
  url.searchParams.set(
    "subscribed_fields",
    "messages,messaging_postbacks,message_deliveries,message_reads"
  );
  url.searchParams.set("access_token", pageAccessToken);
  const data = await graphFetch(url.toString(), { method: "POST" });
  if (!data.success) {
    throw new Error("Meta nije potvrdila pretplatu na webhook za ovu stranicu.");
  }
}

// Facebook Messenger and Instagram Direct both send through the same Page
// Send API endpoint/token — the only difference is which channel the
// recipient id (PSID vs IGSID) belongs to.
async function sendPageMessage(pageAccessToken, recipientId, text) {
  const url = new URL(`${GRAPH_API_BASE}/me/messages`);
  url.searchParams.set("access_token", pageAccessToken);
  const data = await graphFetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });
  return data.message_id;
}

async function sendWhatsAppMessage(whatsappToken, phoneNumberId, to, text) {
  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;
  const data = await graphFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${whatsappToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  return data.messages?.[0]?.id;
}

// Best-effort sender-name lookup for Messenger/Instagram — Meta restricts
// this profile field for many apps/permissions, so a failure here must
// never block message ingestion, just fall back to a generic label.
async function fetchProfileName(pageAccessToken, psid) {
  try {
    const url = new URL(`${GRAPH_API_BASE}/${psid}`);
    url.searchParams.set("fields", "first_name,last_name");
    url.searchParams.set("access_token", pageAccessToken);
    const data = await graphFetch(url.toString());
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    return name || null;
  } catch {
    return null;
  }
}

// Same profile lookup, just the avatar field instead of the name — kept
// separate so a missing photo (common on Instagram, where it's often
// withheld) doesn't also blank out a name that did come back.
async function fetchProfilePicture(pageAccessToken, id) {
  try {
    const url = new URL(`${GRAPH_API_BASE}/${id}`);
    url.searchParams.set("fields", "profile_pic");
    url.searchParams.set("access_token", pageAccessToken);
    const data = await graphFetch(url.toString());
    return data.profile_pic || null;
  } catch {
    return null;
  }
}

// Which of our own Page/IG/WhatsApp accounts a conversation came in on —
// shown under the sender's avatar in the inbox. Memoized per access token
// / phone number so it's one Graph API call per connected account, not
// one per conversation created.
const accountNameCache = new Map();

async function fetchPageAccountName(pageAccessToken) {
  if (accountNameCache.has(pageAccessToken)) return accountNameCache.get(pageAccessToken);
  const promise = (async () => {
    try {
      const url = new URL(`${GRAPH_API_BASE}/me`);
      url.searchParams.set("fields", "name");
      url.searchParams.set("access_token", pageAccessToken);
      const data = await graphFetch(url.toString());
      return data.name || null;
    } catch {
      return null;
    }
  })();
  accountNameCache.set(pageAccessToken, promise);
  return promise;
}

async function fetchWhatsAppAccountName(whatsappToken, phoneNumberId) {
  const cacheKey = `wa:${phoneNumberId}`;
  if (accountNameCache.has(cacheKey)) return accountNameCache.get(cacheKey);
  const promise = (async () => {
    try {
      const url = new URL(`${GRAPH_API_BASE}/${phoneNumberId}`);
      url.searchParams.set("fields", "verified_name,display_phone_number");
      const data = await graphFetch(url.toString(), {
        headers: { Authorization: `Bearer ${whatsappToken}` },
      });
      return data.verified_name || data.display_phone_number || null;
    } catch {
      return null;
    }
  })();
  accountNameCache.set(cacheKey, promise);
  return promise;
}

// Converts one Messenger webhook `entry` into the unified message shape,
// plus any delivery/read receipts in the same entry — same {messages,
// statusUpdates} shape normalizeWhatsAppEntry already returns below, so
// the webhook handler processes both the same way. Postbacks (button
// clicks) are still skipped — only text messages and receipts matter here.
function normalizeMessengerEntry(entry) {
  const messages = [];
  const statusUpdates = [];
  const pageId = entry.id;
  for (const event of entry.messaging || []) {
    if (event.delivery) {
      // `mids` — the specific message ids Meta confirms as delivered.
      (event.delivery.mids || []).forEach((mid) =>
        statusUpdates.push({ messageId: mid, status: "delivered" })
      );
      continue;
    }
    if (event.read) {
      // Read receipts carry a `watermark` (epoch ms), not specific message
      // ids — it means "everything up to this timestamp is read", not a
      // list to match by messageId like `delivery`/WhatsApp statuses.
      statusUpdates.push({ watermark: event.read.watermark, status: "read" });
      continue;
    }
    if (!event.message || event.message.is_echo) continue;
    messages.push({
      platform: "facebook",
      messageId: event.message.mid,
      senderId: event.sender.id,
      pageId,
      text: event.message.text || "",
      timestamp: new Date(event.timestamp).toISOString(),
      status: "received",
    });
  }
  return { messages, statusUpdates };
}

// Instagram Direct webhooks use the same `messaging` shape as Messenger,
// just under object: "instagram".
function normalizeInstagramEntry(entry) {
  const { messages, statusUpdates } = normalizeMessengerEntry(entry);
  return { messages: messages.map((m) => ({ ...m, platform: "instagram" })), statusUpdates };
}

// WhatsApp Cloud API webhooks nest everything under entry.changes[].value —
// `messages` for inbound texts, `statuses` for delivery/read receipts on
// messages we sent.
function normalizeWhatsAppEntry(entry) {
  const messages = [];
  const statusUpdates = [];

  for (const change of entry.changes || []) {
    const value = change.value || {};
    const phoneNumberId = value.metadata?.phone_number_id;
    const contactsByWaId = new Map((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));

    for (const msg of value.messages || []) {
      if (msg.type !== "text") continue;
      messages.push({
        platform: "whatsapp",
        messageId: msg.id,
        senderId: msg.from,
        senderName: contactsByWaId.get(msg.from) || null,
        pageId: phoneNumberId,
        text: msg.text?.body || "",
        timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
        status: "received",
      });
    }

    for (const status of value.statuses || []) {
      statusUpdates.push({ messageId: status.id, status: status.status });
    }
  }

  return { messages, statusUpdates };
}

module.exports = {
  verifySignature,
  exchangeForLongLivedUserToken,
  listManagedPages,
  subscribePage,
  sendPageMessage,
  sendWhatsAppMessage,
  fetchProfileName,
  fetchProfilePicture,
  fetchPageAccountName,
  fetchWhatsAppAccountName,
  normalizeMessengerEntry,
  normalizeInstagramEntry,
  normalizeWhatsAppEntry,
};
