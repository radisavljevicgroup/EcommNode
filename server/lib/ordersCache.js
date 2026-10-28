const { createJsonFile } = require("./jsonFile");
const { createWooClient } = require("./woocommerce");
const { mapOrder } = require("./mapOrder");
const { mapShopifyOrder } = require("./mapShopifyOrder");
const { fetchAllShopifyOrdersRaw } = require("./shopify");
const { getStaleOrderThresholdDays } = require("./settingsStore");
const { getCallCount } = require("./orderCallsStore");

const file = createJsonFile("orders-cache.json", {});
let cache = file.read();

const SYNC_MAX_AGE_MS = 60 * 60 * 1000; // 1h
// Bump whenever mapOrder/mapShopifyOrder start producing something new
// (e.g. 2 = engraving options in item.meta): orders cached by older code
// don't have it, and without this they'd keep being served for up to an
// hour after a deploy — the first read after a restart resyncs instead.
const CACHE_FORMAT = 2;
const WC_PAGE_SIZE = 100;
// A single WooCommerce orders page (100 items) takes ~2s on these stores,
// and some stores have 10,000+ orders in their full history — fetching
// everything would take many minutes. Analytics only needs a recent
// rolling window, so bound the sync and always run it in the background
// rather than blocking a request on it. 14 months (not 12) so the YoY
// trend comparison has a full same-months-last-year range available.
const SYNC_WINDOW_MONTHS = 14;
const MAX_SYNC_PAGES = 50; // hard safety cap (~5,000 orders per store)

const syncing = new Set();
const syncErrors = new Map();

async function fetchAllWooOrders(connection) {
  const client = createWooClient(connection);
  const after = new Date();
  after.setMonth(after.getMonth() - SYNC_WINDOW_MONTHS);

  const orders = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get("orders", {
      page,
      per_page: WC_PAGE_SIZE,
      after: after.toISOString(),
      orderby: "date",
      order: "desc",
    });
    orders.push(...response.data.map((o) => mapOrder(o, null)));
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0 || page >= MAX_SYNC_PAGES) break;
    page += 1;
  }
  return orders;
}

async function fetchAllShopifyOrders(connection) {
  const orders = await fetchAllShopifyOrdersRaw(connection, { sinceMonths: SYNC_WINDOW_MONTHS });
  return orders.map((o) => mapShopifyOrder(o, null));
}

function fetchAllOrders(connection) {
  return connection.platform === "shopify"
    ? fetchAllShopifyOrders(connection)
    : fetchAllWooOrders(connection);
}

// Without the (Shopify-approval-gated) read_all_orders scope, Shopify's API
// only ever returns orders from the last 60 days, no matter what date range
// we ask for — so a plain replace here would silently delete every Shopify
// order we'd already captured once it aged out of that 60-day window, on
// the very next hourly resync. Merge the fresh fetch over whatever we
// already have by id instead: an order still inside the 60-day window gets
// its latest status/total, one that has aged out keeps whatever we last
// saw for it. WooCommerce doesn't need this — its API actually returns the
// full SYNC_WINDOW_MONTHS range every time, so replace already behaves
// like a merge there.
function mergeOrders(existing, fresh) {
  const byId = new Map(existing.map((o) => [o.id, o]));
  for (const o of fresh) byId.set(o.id, o);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - SYNC_WINDOW_MONTHS);
  return [...byId.values()].filter((o) => new Date(o.dateCreated) >= cutoff);
}

async function syncConnection(connection) {
  if (syncing.has(connection.id)) return;
  syncing.add(connection.id);
  syncErrors.delete(connection.id);
  try {
    const fresh = await fetchAllOrders(connection);
    const orders =
      connection.platform === "shopify"
        ? mergeOrders(cache[connection.id]?.orders || [], fresh)
        : fresh;
    cache[connection.id] = { syncedAt: new Date().toISOString(), format: CACHE_FORMAT, orders };
    file.write(cache);
  } catch (err) {
    syncErrors.set(connection.id, err?.message || "Sinhronizacija nije uspela.");
  } finally {
    syncing.delete(connection.id);
  }
}

// Orders created or changed since the cache was last written, fetched live
// and merged into it — for pages that can't show a list that's an hour (or
// a whole night, if nobody opened anything) out of date, e.g. Interni
// nalozi in ecommnode-premium, where an order missing from the list never
// gets an internal order. readCache only refreshes in the background and
// serves the stale copy meanwhile. Only what changed is fetched
// (modified_after / updated_at_min), so it's one request per store, not a
// full sync. A store that doesn't answer keeps its cached orders.
const RECENT_MAX_PAGES = 5;
// Overlap with the last fetch, so an order written while it ran isn't lost.
const RECENT_OVERLAP_MS = 5 * 60 * 1000;

async function fetchRecentWooOrders(connection, since) {
  const client = createWooClient(connection);
  const orders = [];
  for (let page = 1; page <= RECENT_MAX_PAGES; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.get("orders", {
      page,
      per_page: WC_PAGE_SIZE,
      modified_after: since,
      dates_are_gmt: true,
      orderby: "date",
      order: "desc",
    });
    orders.push(...response.data.map((o) => mapOrder(o, null)));
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0) break;
  }
  return orders;
}

// Everything else that reads this cache (Porudžbine, order-distribution,
// dashboard...) used to see a new order only after the hourly full sync —
// which itself only starts on the first read after the hour is up, serves
// the stale copy to that read, and takes minutes on big stores, so an
// order regularly showed up 2-3h late. Those reads now refresh recent
// orders too, at most once per RECENT_MIN_INTERVAL_MS per store (a failed
// attempt counts, so a store that's down isn't hit on every request).
const RECENT_MIN_INTERVAL_MS = 60 * 1000;
// How long a request waits for that refresh before answering from the
// cache anyway (the refresh still lands for the next read).
const RECENT_WAIT_MS = 8000;

const recentRefreshing = new Map(); // connectionId -> in-flight promise
const recentAttemptAt = new Map(); // connectionId -> ms of last attempt

async function refreshRecentConnection(connection) {
  const entry = cache[connection.id];
  // Nothing cached yet — the full sync readCache starts covers it.
  if (!entry || entry.format !== CACHE_FORMAT || !entry.syncedAt) return;
  const base = Math.max(Date.parse(entry.syncedAt) || 0, Date.parse(entry.recentAt) || 0);
  const since = new Date(base - RECENT_OVERLAP_MS).toISOString();
  const startedAt = new Date().toISOString();
  recentAttemptAt.set(connection.id, Date.now());
  try {
    const fresh =
      connection.platform === "shopify"
        ? (await fetchAllShopifyOrdersRaw(connection, { updatedAtMin: since })).map((o) =>
            mapShopifyOrder(o, null)
          )
        : await fetchRecentWooOrders(connection, since);
    // A full sync may have replaced the entry meanwhile — merge into that.
    const current = cache[connection.id] || entry;
    cache[connection.id] = { ...current, recentAt: startedAt, orders: mergeOrders(current.orders, fresh) };
    file.write(cache);
  } catch (err) {
    console.error(`[orders-cache] nove porudžbine (${connection.siteUrl}):`, err?.message);
  }
}

// minIntervalMs: skip a store refreshed (or attempted) that recently. 0 —
// what Interni nalozi uses — always fetches, so an order that arrived
// seconds ago still makes it into the internal order.
async function refreshRecentOrders(connections, { minIntervalMs = 0 } = {}) {
  await Promise.all(
    connections.map((connection) => {
      const inFlight = recentRefreshing.get(connection.id);
      if (inFlight) return inFlight;
      if (Date.now() - (recentAttemptAt.get(connection.id) || 0) < minIntervalMs) return null;
      const promise = refreshRecentConnection(connection).finally(() =>
        recentRefreshing.delete(connection.id)
      );
      recentRefreshing.set(connection.id, promise);
      return promise;
    })
  );
}

// For request handlers: refresh recent orders (throttled), but don't hold
// the response longer than RECENT_WAIT_MS on a slow store.
function freshenOrders(connections) {
  return Promise.race([
    refreshRecentOrders(connections, { minIntervalMs: RECENT_MIN_INTERVAL_MS }),
    new Promise((resolve) => setTimeout(resolve, RECENT_WAIT_MS)),
  ]);
}

function isStale(entry) {
  if (!entry || entry.format !== CACHE_FORMAT) return true;
  return Date.now() - new Date(entry.syncedAt).getTime() > SYNC_MAX_AGE_MS;
}

// Non-blocking: returns whatever is cached right now (possibly empty on
// the very first call for a connection) and kicks off a background sync
// if the cache is missing/stale, without waiting for it to finish — plus a
// throttled recent-orders refresh, so callers that don't await
// freshenOrders still pick new orders up on their next read.
function readCache(connection) {
  const entry = cache[connection.id];
  if (isStale(entry) && !syncing.has(connection.id)) {
    syncConnection(connection);
  }
  refreshRecentOrders([connection], { minIntervalMs: RECENT_MIN_INTERVAL_MS });
  return entry || { syncedAt: null, orders: [] };
}

// Neither WooCommerce nor Shopify has a dedicated "pickup vs shipped" field —
// it's inferred from the shipping method's title, which is exactly what
// store owners set when they configure a "Lično preuzimanje" / "Local
// pickup" shipping option.
const PICKUP_KEYWORDS = ["lično", "licno", "preuzimanje", "pickup", "poslovnic"];

function isPickupOrder(order) {
  const method = (order.shippingMethod || "").toLowerCase();
  return PICKUP_KEYWORDS.some((kw) => method.includes(kw));
}

function getOrdersForConnections(connections) {
  const tagSource = connections.length > 1;
  const entries = connections.map((c) => readCache(c));
  return entries.flatMap((entry, i) =>
    entry.orders.map((o) => ({
      ...o,
      connectionId: connections[i].id,
      sourceSiteUrl: tagSource ? connections[i].siteUrl : null,
      callCount: getCallCount(connections[i].id, o.id),
      isPickup: isPickupOrder(o),
    }))
  );
}

// Same as getOrdersForConnections, but always tags the real source site
// regardless of how many connections were queried. Orders.jsx only wants
// the tag when multiple stores are shown at once (getOrdersForConnections
// above), but per-store breakdowns (e.g. top categories by store) need the
// real site even when just one connection was queried.
function getOrdersForConnectionsTagged(connections) {
  const entries = connections.map((c) => readCache(c));
  return entries.flatMap((entry, i) =>
    entry.orders.map((o) => ({
      ...o,
      connectionId: connections[i].id,
      sourceSiteUrl: connections[i].siteUrl,
      callCount: getCallCount(connections[i].id, o.id),
      isPickup: isPickupOrder(o),
    }))
  );
}

// Only these two statuses count as "stuck" — cancelled/refunded/failed orders
// are already resolved (just not successfully), and completed ones are done.
const STALE_STATUSES = ["pending", "processing"];

function getStaleOrders(connections, { page, perPage, company }) {
  const thresholdDays = getStaleOrderThresholdDays(company);
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  const all = getOrdersForConnections(connections);
  const stale = all
    .filter((o) => STALE_STATUSES.includes(o.status))
    .filter((o) => new Date(o.dateCreated).getTime() < cutoff)
    .sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));

  const start = (page - 1) * perPage;
  return {
    orders: stale.slice(start, start + perPage),
    pagination: {
      page,
      perPage,
      total: stale.length,
      totalPages: Math.max(1, Math.ceil(stale.length / perPage)),
    },
  };
}

// Orders that are done (status "completed") but never got a fiscal receipt
// issued — worth flagging since a completed sale should normally be
// fiscalized. Orders still in progress aren't included: they may simply not
// be fiscalized yet.
function getUnfiscalizedOrders(connections, { page, perPage }) {
  const all = getOrdersForConnections(connections);
  const unfiscalized = all
    .filter((o) => o.status === "completed" && !o.fiscalized)
    .sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));

  const start = (page - 1) * perPage;
  return {
    orders: unfiscalized.slice(start, start + perPage),
    pagination: {
      page,
      perPage,
      total: unfiscalized.length,
      totalPages: Math.max(1, Math.ceil(unfiscalized.length / perPage)),
    },
  };
}

// Orders waiting for graviranje/personalization work — `keys` is the
// pending set from personalizationStore.getPendingPersonalizationKeys
// (already files-present-and-not-completed), computed there since that
// data lives in Supabase, not this cache.
function getPersonalizationOrders(connections, { page, perPage, keys }) {
  const all = getOrdersForConnections(connections);
  const pending = all
    .filter((o) => keys.has(`${o.connectionId}:${o.id}`))
    .sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));

  const start = (page - 1) * perPage;
  return {
    orders: pending.slice(start, start + perPage),
    pagination: {
      page,
      perPage,
      total: pending.length,
      totalPages: Math.max(1, Math.ceil(pending.length / perPage)),
    },
  };
}

function matchesSearch(order, needle) {
  const haystack = [
    order.number,
    order.id,
    order.billing?.firstName,
    order.billing?.lastName,
    order.billing?.email,
    order.billing?.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

// Backs the main Porudžbine list. Paginating a live WooCommerce API call on
// every page click is slow (each request round-trips to the real store, and
// the "all integrations" view has to do that for every connected store at
// once) — this instead pages over the same local cache the stale/
// unfiscalized/analytics views already use, so navigating pages is instant
// and only touches the network in the background sync.
// Whether an order has a product on the personalization allowlist — matched
// by product ID or SKU, case-insensitively, same as Orders.jsx's
// personalizableProductId (the icon on the order card).
function hasPersonalizableItem(order, productIds) {
  const ids = new Set(productIds.map((id) => String(id).trim().toLowerCase()));
  return (order.items || []).some(
    (item) =>
      ids.has(String(item.productId ?? "").toLowerCase()) ||
      ids.has(String(item.sku ?? "").toLowerCase())
  );
}

// personalized: { mode: "yes" | "pending" | "done", productIds, completedKeys }
// — "Personalizacija" filter on Porudžbine; null when not filtering.
function getOrdersPage(
  connections,
  { page, perPage, search, status, fulfillment, fiscal, personalized }
) {
  let orders = getOrdersForConnections(connections).sort(
    (a, b) => new Date(b.dateCreated) - new Date(a.dateCreated)
  );

  if (status) {
    orders = orders.filter((o) => status.includes(o.status));
  }
  if (fulfillment === "pickup") {
    orders = orders.filter((o) => o.isPickup);
  } else if (fulfillment === "shipping") {
    orders = orders.filter((o) => !o.isPickup);
  }
  if (fiscal === "yes") {
    orders = orders.filter((o) => o.fiscalized);
  } else if (fiscal === "no") {
    orders = orders.filter((o) => !o.fiscalized);
  }
  if (personalized) {
    const { mode, productIds, completedKeys } = personalized;
    orders = orders.filter((o) => {
      if (!hasPersonalizableItem(o, productIds)) return false;
      if (mode === "yes") return true;
      const done = completedKeys.has(`${o.connectionId}:${o.id}`);
      return mode === "done" ? done : !done;
    });
  }
  if (search) {
    const needle = search.trim().toLowerCase();
    if (needle) orders = orders.filter((o) => matchesSearch(o, needle));
  }

  const start = (page - 1) * perPage;
  return {
    orders: orders.slice(start, start + perPage),
    pagination: {
      page,
      perPage,
      total: orders.length,
      totalPages: Math.max(1, Math.ceil(orders.length / perPage)),
    },
  };
}

function getSyncStatus(connections) {
  return connections.map((c) => ({
    connectionId: c.id,
    siteUrl: c.siteUrl,
    syncedAt: cache[c.id]?.syncedAt || null,
    orderCount: cache[c.id]?.orders?.length || 0,
    syncing: syncing.has(c.id),
    error: syncErrors.get(c.id) || null,
  }));
}

module.exports = {
  syncConnection,
  refreshRecentOrders,
  freshenOrders,
  getOrdersForConnections,
  getOrdersForConnectionsTagged,
  getOrdersPage,
  getStaleOrders,
  getUnfiscalizedOrders,
  getPersonalizationOrders,
  getSyncStatus,
};
