const { Router } = require("express");
const crypto = require("crypto");
const meta = require("../lib/metaMessaging");
const viber = require("../lib/viberMessaging");
const store = require("../lib/inboxStore");
const connectionsStore = require("../lib/inboxConnectionsStore");

const router = Router();

// Multi-brand lookup for an inbound message — matches the Facebook/
// Instagram Page id or WhatsApp phone_number_id from the webhook payload
// against a connection registered for that specific brand (Parker,
// Papagaj, Maped, ...). Falls back to the single global env-var account
// when nothing is registered, so the single-brand .env setup described
// earlier keeps working unchanged for anyone who only has one channel.
function resolveInboundAccount(platform, pageId) {
  if (platform === "whatsapp") {
    const connection = pageId ? connectionsStore.findByPhoneNumberId(pageId) : null;
    if (connection) return { token: connection.accessToken, accountLabel: connection.label };
    return { token: process.env.WHATSAPP_TOKEN, accountLabel: null };
  }

  const connection = pageId ? connectionsStore.findByPageId(platform, pageId) : null;
  if (connection) return { token: connection.accessToken, accountLabel: connection.label };

  const token =
    platform === "instagram" && process.env.IG_PAGE_ACCESS_TOKEN
      ? process.env.IG_PAGE_ACCESS_TOKEN
      : process.env.PAGE_ACCESS_TOKEN;
  return { token, accountLabel: null };
}

// Same idea for replying — a conversation already has its platform +
// page_id stored from when it was created, so no lookup ambiguity here.
function resolveOutboundAccount(conversation) {
  if (conversation.platform === "whatsapp") {
    const connection = conversation.page_id ? connectionsStore.findByPhoneNumberId(conversation.page_id) : null;
    if (connection) return { token: connection.accessToken, phoneNumberId: connection.phoneNumberId };
    return { token: process.env.WHATSAPP_TOKEN, phoneNumberId: conversation.page_id || process.env.WHATSAPP_PHONE_NUMBER_ID };
  }

  // Viber has no external page/number id to match on — a Viber connection's
  // own id doubles as its conversations' page_id (set when the connection
  // is created below), so a direct lookup is enough.
  if (conversation.platform === "viber") {
    const connection = conversation.page_id ? connectionsStore.getConnection(conversation.page_id) : null;
    return { token: connection?.accessToken };
  }

  const connection = conversation.page_id
    ? connectionsStore.findByPageId(conversation.platform, conversation.page_id)
    : null;
  if (connection) return { token: connection.accessToken };

  const token =
    conversation.platform === "instagram" && process.env.IG_PAGE_ACCESS_TOKEN
      ? process.env.IG_PAGE_ACCESS_TOKEN
      : process.env.PAGE_ACCESS_TOKEN;
  return { token };
}

// Viber has no App-Dashboard webhook config — each bot registers its own
// URL by calling the Viber API with its own auth token (see connect route
// below). The URL just needs to be unique per bot so an inbound message
// can be traced back to the right connection/brand; there's no
// Meta-style signature to verify it with, so an unguessable id in the
// path (crypto.randomUUID(), already the connection's own id) is what
// keeps it from being spammed by outsiders.
function viberWebhookUrl(connectionId) {
  const base = process.env.PUBLIC_BASE_URL;
  const path = `/api/inbox/webhook/viber/${connectionId}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

function toPublicConnection(c) {
  return {
    id: c.id,
    label: c.label,
    platform: c.platform,
    pageId: c.pageId || null,
    phoneNumberId: c.phoneNumberId || null,
    webhookUrl: c.platform === "viber" ? viberWebhookUrl(c.id) : null,
    // accessToken never leaves this function — same rule as Meta Ads
    // connections (routes/meta.js's toPublic).
  };
}

function toPublicConversation(c) {
  return {
    id: c.id,
    platform: c.platform,
    senderId: c.sender_id,
    senderName: c.sender_name,
    senderAvatarUrl: c.sender_avatar_url,
    accountLabel: c.account_label,
    lastMessageText: c.last_message_text,
    lastMessageAt: c.last_message_at,
    unreadCount: c.unread_count,
  };
}

function toPublicMessage(m) {
  return {
    id: m.id,
    messageId: m.message_id,
    platform: m.platform,
    direction: m.direction,
    senderId: m.sender_id,
    senderName: m.sender_name,
    text: m.text,
    status: m.status,
    timestamp: m.created_at,
  };
}

// --- Webhook verification (GET) ---------------------------------------
// Meta calls this once when the webhook URL is registered in the App
// Dashboard (same handshake for Messenger, Instagram, and WhatsApp), and
// again any time the subscription is re-verified.
router.get("/inbox/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// --- Inbound events (POST) ---------------------------------------------
router.post("/inbox/webhook", async (req, res) => {
  const signature = req.header("x-hub-signature-256");
  if (!meta.verifySignature(req.rawBody, signature, process.env.META_APP_SECRET)) {
    return res.sendStatus(403);
  }

  // Acknowledge immediately — Meta treats a slow/failed response as a
  // delivery failure and retries the same event repeatedly.
  res.sendStatus(200);

  const body = req.body || {};
  try {
    if (body.object === "page" || body.object === "instagram") {
      const normalize = body.object === "page" ? meta.normalizeMessengerEntry : meta.normalizeInstagramEntry;
      const platform = body.object === "page" ? "facebook" : "instagram";

      for (const entry of body.entry || []) {
        // pageId is the same for every message in this entry (it's the
        // entry's own id) — resolve which brand it belongs to once per
        // entry rather than once per message.
        const { token, accountLabel: registeredLabel } = resolveInboundAccount(platform, entry.id);

        for (const message of normalize(entry)) {
          if (!message.text) continue;
          const conversation = await store.getOrCreateConversation({
            platform: message.platform,
            senderId: message.senderId,
            pageId: message.pageId,
            enrich: token
              ? async () => {
                  const [senderAvatarUrl, senderName, fetchedLabel] = await Promise.all([
                    meta.fetchProfilePicture(token, message.senderId),
                    meta.fetchProfileName(token, message.senderId),
                    // A brand registered in inbox-connections.json already has
                    // a human label — skip the extra Graph API call for it.
                    registeredLabel ? Promise.resolve(registeredLabel) : meta.fetchPageAccountName(token),
                  ]);
                  return { senderAvatarUrl, senderName, accountLabel: fetchedLabel };
                }
              : undefined,
          });
          await store.saveInboundMessage({ conversation, message });
        }
      }
    } else if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry || []) {
        const { messages, statusUpdates } = meta.normalizeWhatsAppEntry(entry);
        for (const message of messages) {
          if (!message.text) continue;
          const { token, accountLabel: registeredLabel } = resolveInboundAccount("whatsapp", message.pageId);
          const conversation = await store.getOrCreateConversation({
            platform: "whatsapp",
            senderId: message.senderId,
            senderName: message.senderName,
            pageId: message.pageId,
            enrich: token
              ? async () => ({
                  accountLabel: registeredLabel || (await meta.fetchWhatsAppAccountName(token, message.pageId)),
                })
              : undefined,
          });
          await store.saveInboundMessage({ conversation, message });
        }
        for (const update of statusUpdates) {
          await store.updateMessageStatus("whatsapp", update.messageId, update.status);
        }
      }
    }
  } catch (err) {
    // The 200 already went out — Meta won't retry, so just log for
    // debugging instead of throwing into an already-finished response.
    console.error("Greška pri obradi inbox webhook-a:", err);
  }
});

// One URL per Viber bot (see viberWebhookUrl above) rather than one shared
// endpoint — Viber's payload doesn't say which Public Account/bot received
// the message, only the URL you registered for that specific bot does.
router.post("/inbox/webhook/viber/:connectionId", async (req, res) => {
  res.sendStatus(200);

  try {
    const connection = connectionsStore.getConnection(req.params.connectionId);
    if (!connection || connection.platform !== "viber") return;

    const message = viber.normalizeViberEvent(req.body || {});
    if (!message || !message.senderId || !message.text) return;

    const conversation = await store.getOrCreateConversation({
      platform: "viber",
      senderId: message.senderId,
      senderName: message.senderName,
      pageId: connection.id,
      enrich: async () => ({ senderAvatarUrl: message.senderAvatarUrl, accountLabel: connection.label }),
    });
    await store.saveInboundMessage({ conversation, message });
  } catch (err) {
    console.error("Greška pri obradi Viber webhook-a:", err);
  }
});

// --- Frontend API --------------------------------------------------------
router.get("/inbox/conversations", async (req, res) => {
  try {
    const conversations = await store.listConversations();
    res.json({ conversations: conversations.map(toPublicConversation) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Ne mogu da učitam konverzacije." });
  }
});

router.get("/inbox/conversations/:id/messages", async (req, res) => {
  try {
    const conversation = await store.getConversation(req.params.id);
    if (!conversation) return res.status(404).json({ error: "Konverzacija nije pronađena." });

    const messages = await store.listMessages(req.params.id);
    res.json({ conversation: toPublicConversation(conversation), messages: messages.map(toPublicMessage) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Ne mogu da učitam poruke." });
  }
});

router.post("/inbox/conversations/:id/read", async (req, res) => {
  try {
    await store.markConversationRead(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Ne mogu da označim konverzaciju kao pročitanu." });
  }
});

function sendErrorMessage(err) {
  if (err.status === 401 || err.status === 403) {
    return `Access token je nevažeći ili je istekao. (Meta poruka: ${err.message})`;
  }
  return err.message || "Slanje poruke nije uspelo.";
}

router.post("/inbox/conversations/:id/messages", async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Poruka ne može biti prazna." });
  }

  try {
    const conversation = await store.getConversation(req.params.id);
    if (!conversation) return res.status(404).json({ error: "Konverzacija nije pronađena." });

    let messageId;
    let outboundSenderId;

    if (conversation.platform === "facebook" || conversation.platform === "instagram") {
      const { token } = resolveOutboundAccount(conversation);
      if (!token) {
        return res.status(400).json({ error: "Nema podešenog access token-a za ovaj nalog (PAGE_ACCESS_TOKEN ili registrovana konekcija)." });
      }
      messageId = await meta.sendPageMessage(token, conversation.sender_id, text.trim());
      outboundSenderId = conversation.page_id || "page";
    } else if (conversation.platform === "whatsapp") {
      const { token, phoneNumberId } = resolveOutboundAccount(conversation);
      if (!token || !phoneNumberId) {
        return res.status(400).json({ error: "WHATSAPP_TOKEN ili broj telefona nije podešen za ovaj nalog." });
      }
      messageId = await meta.sendWhatsAppMessage(token, phoneNumberId, conversation.sender_id, text.trim());
      outboundSenderId = phoneNumberId;
    } else if (conversation.platform === "viber") {
      const { token } = resolveOutboundAccount(conversation);
      if (!token) {
        return res.status(400).json({ error: "Nema podešenog access token-a za ovaj Viber nalog." });
      }
      messageId = await viber.sendViberMessage(token, conversation.sender_id, text.trim(), conversation.account_label);
      outboundSenderId = conversation.page_id || "viber-bot";
    } else {
      return res.status(400).json({ error: "Nepoznata platforma." });
    }

    const saved = await store.saveOutboundMessage({
      conversationId: conversation.id,
      platform: conversation.platform,
      senderId: outboundSenderId,
      text: text.trim(),
      messageId,
      status: "sent",
    });

    res.json({ message: toPublicMessage(saved) });
  } catch (err) {
    res.status(400).json({ error: sendErrorMessage(err) });
  }
});

// --- Per-brand connection management --------------------------------------
// No Settings UI wired up to these yet — for now, register a brand's
// channel with a direct POST (see server/scripts/README or the API docs).
// The shape matches what a future "Meta Inbox" integration card would
// submit, so that UI can be added later without changing this contract.
router.get("/inbox/connections", (req, res) => {
  res.json({ connections: connectionsStore.getConnections().map(toPublicConnection) });
});

router.post("/inbox/connections", async (req, res) => {
  const { label, platform, pageId, phoneNumberId, accessToken } = req.body || {};

  if (!label || !platform || !accessToken) {
    return res.status(400).json({ error: "Nedostaju podaci: naziv brenda, platforma i access token su obavezni." });
  }
  if (!["facebook", "instagram", "whatsapp", "viber"].includes(platform)) {
    return res.status(400).json({ error: "Platforma mora biti facebook, instagram, whatsapp ili viber." });
  }
  if (platform === "whatsapp" && !phoneNumberId) {
    return res.status(400).json({ error: "WhatsApp konekcija zahteva phoneNumberId." });
  }
  if (platform === "facebook" || platform === "instagram") {
    if (!pageId) return res.status(400).json({ error: "Facebook/Instagram konekcija zahteva pageId." });
  }

  const connection = {
    id: crypto.randomUUID(),
    label,
    platform,
    pageId: pageId || null,
    phoneNumberId: phoneNumberId || null,
    accessToken,
  };

  let webhookWarning = null;
  if (platform === "viber") {
    // Viber has no external page id of its own — the connection's own id
    // is what its conversations get stored under (see resolveOutboundAccount).
    connection.pageId = connection.id;
    try {
      await viber.setWebhook(accessToken, viberWebhookUrl(connection.id));
    } catch (err) {
      // Still save the connection — a bad/expired token surfaces the same
      // way a wrong access token would for any other channel (replies will
      // fail with a clear error), and PUBLIC_BASE_URL not being set yet is
      // a normal local-dev state, not a reason to block connecting.
      webhookWarning = `Nalog je sačuvan, ali auto-registracija webhook-a nije uspela: ${err.message}. Registruj ga ručno na ${viberWebhookUrl(connection.id)}.`;
    }
  }

  connectionsStore.addConnection(connection);
  res.json({ connection: toPublicConnection(connection), webhookWarning });
});

router.post("/inbox/connections/:id/update", (req, res) => {
  const existing = connectionsStore.getConnection(req.params.id);
  if (!existing) return res.status(404).json({ error: "Konekcija nije pronađena." });

  const { label, pageId, phoneNumberId, accessToken } = req.body || {};
  const patch = {};
  if (label !== undefined) patch.label = label;
  if (pageId !== undefined) patch.pageId = pageId;
  if (phoneNumberId !== undefined) patch.phoneNumberId = phoneNumberId;
  if (accessToken !== undefined) patch.accessToken = accessToken;

  const updated = connectionsStore.updateConnection(req.params.id, patch);
  res.json({ connection: toPublicConnection(updated) });
});

router.post("/inbox/connections/:id/delete", (req, res) => {
  const connections = connectionsStore.removeConnection(req.params.id);
  res.json({ connections: connections.map(toPublicConnection) });
});

module.exports = router;
