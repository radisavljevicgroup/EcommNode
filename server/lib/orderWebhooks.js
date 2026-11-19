const crypto = require("crypto");
const { createJsonFile } = require("./jsonFile");
const { createWooClient } = require("./woocommerce");

// WooCommerce order webhooks: the store itself POSTs every new/changed order
// to this server the moment it happens (routes/wooWebhooks.js), instead of
// this server asking each store "anything new?" at most once a minute — and
// only while someone has a page open (ordersCache.js's recent refresh). That
// polling stays as the safety net (a store whose API key is read-only, a
// webhook WooCommerce disabled after failed deliveries...), just less often
// for stores whose webhooks are in place.
//
// Registered automatically through the store's REST API (needs a Read/Write
// API key), only on the server whose PUBLIC_BASE_URL is a public https
// address — i.e. production. A dev machine (PUBLIC_BASE_URL empty or
// localhost) never touches the stores' webhooks; it keeps polling.
// WOO_WEBHOOKS=false switches registration off altogether.
//
// Our webhooks are recognized by their delivery URL (one per connection),
// so this never touches webhooks the store has for anything else.

const file = createJsonFile("order-webhooks.json", {});
// connectionId -> { secret, ok, error, checkedAt }
let state = file.read();

const TOPICS = ["order.created", "order.updated", "order.deleted", "order.restored"];
// How often each store's webhooks are re-checked (re-created if someone
// deleted them, re-activated if WooCommerce disabled them after failed
// deliveries).
const RECHECK_OK_MS = 6 * 60 * 60 * 1000;
const RECHECK_FAILED_MS = 60 * 60 * 1000;

const inFlight = new Map(); // connectionId -> promise

function save() {
  file.write(state);
}

function publicBase() {
  if (process.env.WOO_WEBHOOKS === "false") return null;
  const base = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) return null;
  if (/localhost|127\.0\.0\.1|\[::1\]/i.test(base)) return null;
  return base;
}

function deliveryUrl(connectionId) {
  const base = publicBase();
  return base ? `${base}/api/webhooks/woocommerce/${connectionId}` : null;
}

function getSecret(connectionId) {
  return state[connectionId]?.secret || null;
}

// Webhooks registered and last check succeeded — ordersCache.js polls such
// a store far less often.
function hasActiveWebhooks(connectionId) {
  return Boolean(publicBase() && state[connectionId]?.ok);
}

function noteDelivery(connectionId) {
  const entry = state[connectionId];
  if (!entry) return;
  entry.lastDeliveryAt = new Date().toISOString();
  // Not saved on every delivery (the file write is the expensive part and
  // this is only informational); the next check/registration persists it.
}

async function listOurWebhooks(client, url) {
  const ours = [];
  for (let page = 1; page <= 20; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.get("webhooks", { per_page: 100, page });
    ours.push(...res.data.filter((w) => w.delivery_url === url));
    const totalPages = Number(res.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || res.data.length === 0) break;
  }
  return ours;
}

async function registerWebhooks(connection) {
  const url = deliveryUrl(connection.id);
  if (!url || connection.platform === "shopify") return;
  const client = createWooClient(connection);
  const existing = state[connection.id] || {};
  // A webhook found on the store without the secret we signed it with
  // (lost data file) gets a fresh secret.
  const secret = existing.secret || crypto.randomBytes(32).toString("hex");
  const newSecret = !existing.secret;

  try {
    const ours = await listOurWebhooks(client, url);
    for (const topic of TOPICS) {
      // An active one first, so that's the one kept.
      const matches = ours
        .filter((w) => w.topic === topic)
        .sort((a, b) => (b.status === "active") - (a.status === "active"));
      const [keep, ...duplicates] = matches;
      if (!keep) {
        // eslint-disable-next-line no-await-in-loop
        await client.post("webhooks", {
          name: `EcommNode porudžbine (${topic})`,
          topic,
          delivery_url: url,
          secret,
          status: "active",
        });
      } else if (keep.status !== "active" || newSecret) {
        // eslint-disable-next-line no-await-in-loop
        await client.put(`webhooks/${keep.id}`, { status: "active", secret });
      }
      for (const dup of duplicates) {
        // eslint-disable-next-line no-await-in-loop
        await client.delete(`webhooks/${dup.id}`, { force: true }).catch(() => {});
      }
    }
    state[connection.id] = {
      ...existing,
      secret,
      ok: true,
      error: null,
      checkedAt: new Date().toISOString(),
    };
    save();
    console.log(`[order-webhooks] ${connection.siteUrl}: webhook-ovi aktivni`);
  } catch (err) {
    const status = err?.response?.status;
    const error =
      status === 401 || status === 403
        ? "API ključ prodavnice nema dozvolu za pisanje (Read/Write) — porudžbine se proveravaju povremeno umesto da stižu odmah."
        : err?.response?.data?.message || err?.message || "Registracija webhook-a nije uspela.";
    // Keep a secret only if it may already be on the store.
    state[connection.id] = {
      ...existing,
      secret: existing.secret || null,
      ok: false,
      error,
      checkedAt: new Date().toISOString(),
    };
    save();
    console.error(`[order-webhooks] ${connection.siteUrl}: ${error}`);
  }
}

// Cheap to call on every read: does nothing unless the last check is old.
function ensureWebhooks(connection) {
  if (!connection || connection.platform === "shopify" || !publicBase()) return null;
  if (inFlight.has(connection.id)) return inFlight.get(connection.id);
  const entry = state[connection.id];
  const wait = entry?.ok ? RECHECK_OK_MS : RECHECK_FAILED_MS;
  if (entry?.checkedAt && Date.now() - Date.parse(entry.checkedAt) < wait) return null;
  const promise = registerWebhooks(connection)
    .catch(() => {})
    .finally(() => inFlight.delete(connection.id));
  inFlight.set(connection.id, promise);
  return promise;
}

// Disconnecting a store: remove our webhooks from it, so it doesn't keep
// posting to a URL that now answers 410.
async function removeWebhooks(connection) {
  const url = deliveryUrl(connection.id);
  delete state[connection.id];
  save();
  if (!url || connection.platform === "shopify") return;
  try {
    const client = createWooClient(connection);
    const ours = await listOurWebhooks(client, url);
    await Promise.all(
      ours.map((w) => client.delete(`webhooks/${w.id}`, { force: true }).catch(() => {}))
    );
  } catch {
    // The store may be gone; WooCommerce disables a webhook that keeps
    // getting 410 on its own.
  }
}

function getWebhookStatus(connectionId) {
  if (!publicBase()) return { enabled: false };
  const entry = state[connectionId];
  return {
    enabled: true,
    ok: Boolean(entry?.ok),
    error: entry?.error || null,
    checkedAt: entry?.checkedAt || null,
    lastDeliveryAt: entry?.lastDeliveryAt || null,
  };
}

module.exports = {
  ensureWebhooks,
  removeWebhooks,
  getSecret,
  hasActiveWebhooks,
  noteDelivery,
  getWebhookStatus,
};
