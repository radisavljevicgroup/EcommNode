const VIBER_API_BASE = "https://chatapi.viber.com/pa";

async function viberFetch(path, authToken, body) {
  const res = await fetch(`${VIBER_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": authToken },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // Viber always answers 200 and puts the real result in status/status_message
  // (0 = ok) — an HTTP-level error only means the request itself was malformed.
  if (!res.ok || (data.status !== undefined && data.status !== 0)) {
    const err = new Error(data.status_message || `Viber API greška (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Registers our webhook URL with this specific bot. Viber has no
// App-Dashboard-style manual webhook config like Meta — each Public
// Account's auth token calls this itself to say "send my messages here".
async function setWebhook(authToken, webhookUrl) {
  return viberFetch("/set_webhook", authToken, {
    url: webhookUrl,
    event_types: ["message", "conversation_started"],
  });
}

async function sendViberMessage(authToken, receiverId, text, senderName) {
  const data = await viberFetch("/send_message", authToken, {
    receiver: receiverId,
    type: "text",
    text,
    sender: { name: senderName || "EcommNode" },
  });
  return String(data.message_token);
}

// Only "message" events with a text payload become inbox messages —
// "conversation_started"/"subscribed"/etc are delivery/lifecycle events,
// not something to show in a chat thread.
function normalizeViberEvent(body) {
  if (body.event !== "message" || body.message?.type !== "text") return null;
  return {
    platform: "viber",
    messageId: String(body.message_token),
    senderId: body.sender?.id,
    senderName: body.sender?.name || null,
    senderAvatarUrl: body.sender?.avatar || null,
    text: body.message.text || "",
    timestamp: new Date(body.timestamp).toISOString(),
    status: "received",
  };
}

module.exports = { setWebhook, sendViberMessage, normalizeViberEvent };
