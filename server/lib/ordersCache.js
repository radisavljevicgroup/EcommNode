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
// don't have it. A bump makes the next sync re-read every order (WooCommerce:
// a new backfill from the newest order down), overwriting the old copies by
// id as it goes — the old ones keep being served until then.
// 3 = journeySessionId ("Put kupca").
const CACHE_FORMAT = 3;
const WC_PAGE_SIZE = 100;
// Shopify only: how far back a full sync asks for. Without read_all_orders
// Shopify returns just the last 60 days anyway; mergeOrders keeps whatever
// aged out of that.
const SYNC_WINDOW_MONTHS = 14;
// WooCommerce orders are kept forever, not as a rolling window: the old
// "last 14 months, max 50 pages" full sync replaced the cache every hour, so
// a store with more than 5,000 orders in 14 months silently lost everything
// past the 5,000th (~10 months on the bigger stores). Instead, each hourly
// sync now:
//   1. fetches only orders created/changed since the last sync
//      (modified_after) and merges them in, and
//   2. while the history isn't complete yet, keeps walking backwards
//      (before = oldest cached order) BACKFILL_CHUNK_PAGES pages at a time,
//      writing the cache after each chunk so a restart resumes where it
//      stopped, until WooCommerce has nothing older.
// A page of 100 orders takes ~2s, so a 20,000-order store needs ~7 minutes
// once, in the background; after that a sync is one or two requests.
const BACKFILL_CHUNK_PAGES = 10;
// Overlap with the last fetch, so an order written while it ran isn't lost.
const RECENT_OVERLAP_MS = 5 * 60 * 1000;

const syncing = new Set();
const syncErrors = new Map();

async function fetchWooPages(connection, params, maxPages = Infinity) {
  const client = createWooClient(connection);
  const orders = [];
  let reachedEnd = false;
  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.get("orders", {
      ...params,
      page,
      per_page: WC_PAGE_SIZE,
      dates_are_gmt: true,
      orderby: "date",
      order: "desc",
    });
    orders.push(...response.data.map((o) => mapOrder(o, null)));
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0) {
      reachedEnd = true;
      break;
    }
  }
  return { orders, reachedEnd };
}

function orderCreatedMs(o) {
  // dateCreatedGmt has no offset ("2025-01-31T10:00:00") but is UTC.
  if (o.dateCreatedGmt) return Date.parse(`${o.dateCreatedGmt}Z`);
  return Date.parse(o.dateCreated);
}

// `before` for the next backfill chunk: the oldest order we have, +1s
// because WooCommerce's before is strict and several orders can share that
// second — the ones already cached just get merged again.
function backfillCursor(orders) {
  let oldest = Infinity;
  for (const o of orders) {
    const ms = orderCreatedMs(o);
    if (Number.isFinite(ms) && ms < oldest) oldest = ms;
  }
  return Number.isFinite(oldest) ? new Date(oldest + 1000).toISOString() : null;
}

async function fetchAllShopifyOrders(connection) {
  const orders = await fetchAllShopifyOrdersRaw(connection, { sinceMonths: SYNC_WINDOW_MONTHS });
  return orders.map((o) => mapShopifyOrder(o, null));
}

// Fresh orders overwrite cached ones by id (latest status/total); cached
// orders the fetch didn't return are kept — nothing is ever dropped here.
// Shopify needs this because without read_all_orders its API only returns
// the last 60 days; WooCommerce because its syncs are incremental (above).
function mergeOrders(existing, fresh) {
  const byId = new Map(existing.map((o) => [o.id, o]));
  for (const o of fresh) byId.set(o.id, o);
  return [...byId.values()];
}

// Always merges into cache[connectionId] as it is *now*, not a copy taken
// before an await — refreshRecentConnection may have merged meanwhile.
function mergeIntoCache(connectionId, fresh, patch = {}) {
  const current = cache[connectionId] || { orders: [] };
  cache[connectionId] = { ...current, ...patch, orders: mergeOrders(current.orders || [], fresh) };
  file.write(cache);
  return cache[connectionId];
}

async function syncWooConnection(connection, startedAt) {
  const id = connection.id;
  let entry = cache[id];
  if (!entry || entry.format !== CACHE_FORMAT) {
    // New store, or a CACHE_FORMAT bump: re-read everything from the newest
    // order down. Old copies stay (and are served) until overwritten.
    entry = mergeIntoCache(id, [], {
      syncedAt: null,
      format: CACHE_FORMAT,
      backfill: { done: false, before: null },
    });
  } else if (!entry.backfill) {
    // Cache written by the old 14-month windowed sync: it holds everything
    // from its syncedAt down to its oldest order, so continue from there.
    entry = mergeIntoCache(id, [], {
      backfill: { done: false, before: backfillCursor(entry.orders || []) },
    });
  }

  // 1. Whatever was created or changed since the last sync.
  if (entry.syncedAt) {
    const base = Math.max(Date.parse(entry.syncedAt) || 0, Date.parse(entry.recentAt) || 0);
    const since = new Date(base - RECENT_OVERLAP_MS).toISOString();
    const { orders } = await fetchWooPages(connection, { modified_after: since });
    entry = mergeIntoCache(id, orders, { syncedAt: startedAt });
  }

  // 2. Older history, chunk by chunk, until there's none left.
  while (!entry.backfill?.done) {
    const before = entry.backfill.before;
    // eslint-disable-next-line no-await-in-loop
    const { orders, reachedEnd } = await fetchWooPages(
      connection,
      before ? { before } : {},
      BACKFILL_CHUNK_PAGES
    );
    const nextBefore = backfillCursor(orders) || before;
    entry = mergeIntoCache(id, orders, {
      // The first chunk of a from-scratch backfill starts at the newest
      // order, so from here on step 1 covers anything newer.
      syncedAt: entry.syncedAt || startedAt,
      // A chunk that didn't move the cursor (e.g. 1,000+ orders in one
      // second) would loop forever — treat it as the end.
      backfill: { done: reachedEnd || nextBefore === before, before: nextBefore },
    });
  }
}

async function syncShopifyConnection(connection, startedAt) {
  const fresh = await fetchAllShopifyOrders(connection);
  mergeIntoCache(connection.id, fresh, { syncedAt: startedAt, format: CACHE_FORMAT });
}

async function syncConnection(connection) {
  if (syncing.has(connection.id)) return;
  syncing.add(connection.id);
  syncErrors.delete(connection.id);
  // When the sync started, not when it finished: a backfill takes minutes,
  // and an order changed meanwhile must still be after the next
  // modified_after.
  const startedAt = new Date().toISOString();
  try {
    if (connection.platform === "shopify") {
      await syncShopifyConnection(connection, startedAt);
    } else {
      await syncWooConnection(connection, startedAt);
    }
  } catch (err) {
    // Backfill progress already written stays; the next sync resumes.
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

async function fetchRecentWooOrders(connection, since) {
  const { orders } = await fetchWooPages(connection, { modified_after: since }, RECENT_MAX_PAGES);
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
    mergeIntoCache(connection.id, fresh, { recentAt: startedAt });
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
  // A WooCommerce backfill cut short (restart, store error) resumes on the
  // next read instead of waiting out the hour.
  if (entry.backfill && !entry.backfill.done) return true;
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
    // WooCommerce: older history still being downloaded.
    backfilling: Boolean(cache[c.id]?.backfill && !cache[c.id].backfill.done),
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
  hasPersonalizableItem,
};
