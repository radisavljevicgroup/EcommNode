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

// Converts one Messenger webhook `entry` into the unified message shape.
// Skips delivery/read echoes and postbacks — only actual text messages are
// surfaced in the inbox for now.
function normalizeMessengerEntry(entry) {
  const messages = [];
  const pageId = entry.id;
  for (const event of entry.messaging || []) {
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
  return messages;
}

// Instagram Direct webhooks use the same `messaging` shape as Messenger,
// just under object: "instagram".
function normalizeInstagramEntry(entry) {
  return normalizeMessengerEntry(entry).map((m) => ({ ...m, platform: "instagram" }));
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
