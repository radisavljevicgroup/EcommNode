const crypto = require("crypto");
const { Router } = require("express");
const { getConnectionById } = require("../lib/store");
const { mapOrder } = require("../lib/mapOrder");
const { applyWebhookOrder, removeCachedOrder } = require("../lib/ordersCache");
const { getSecret, noteDelivery } = require("../lib/orderWebhooks");

// Receives WooCommerce's order webhooks (registered by lib/orderWebhooks.js):
// the full order, the moment it's created or changed on the store. Public —
// WooCommerce can't send our Authorization header — so every delivery is
// checked against X-WC-Webhook-Signature (base64 HMAC-SHA256 of the raw
// body with the secret we gave the webhook). Mounted before requireAuth in
// index.js.
//
// Always answers fast: WooCommerce disables a webhook after 5 failed
// deliveries in a row.

const router = Router();

function validSignature(secret, rawBody, signature) {
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post("/webhooks/woocommerce/:connectionId", (req, res) => {
  const connection = getConnectionById(req.params.connectionId);
  // Store disconnected: 410 makes WooCommerce disable the webhook.
  if (!connection) return res.status(410).json({ error: "Nepoznata prodavnica." });

  // The ping WooCommerce sends when a webhook is created/activated is
  // form-encoded ("webhook_id=…"), not an order — just acknowledge it.
  if (!req.is("application/json")) return res.json({ ok: true });

  const signature = req.get("X-WC-Webhook-Signature");
  if (!validSignature(getSecret(connection.id), req.rawBody, signature)) {
    return res.status(401).json({ error: "Neispravan potpis." });
  }

  const topic = req.get("X-WC-Webhook-Topic") || "";
  const body = req.body || {};
  try {
    if (topic === "order.deleted") {
      if (body.id) removeCachedOrder(connection.id, body.id);
    } else if (body.id && body.status) {
      applyWebhookOrder(connection.id, mapOrder(body, null));
    }
    noteDelivery(connection.id);
  } catch (err) {
    console.error(`[order-webhooks] ${connection.siteUrl} (${topic}):`, err?.message);
  }
  res.json({ ok: true });
});

module.exports = router;
