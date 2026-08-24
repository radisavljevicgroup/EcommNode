const { createJsonFile } = require("./jsonFile");
const { createWooClient } = require("./woocommerce");
const { mapOrder } = require("./mapOrder");
const { getStaleOrderThresholdDays } = require("./settingsStore");

const file = createJsonFile("orders-cache.json", {});
let cache = file.read();

const SYNC_MAX_AGE_MS = 60 * 60 * 1000; // 1h
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

async function fetchAllOrders(connection) {
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

async function syncConnection(connection) {
  if (syncing.has(connection.id)) return;
  syncing.add(connection.id);
  syncErrors.delete(connection.id);
  try {
    const orders = await fetchAllOrders(connection);
    cache[connection.id] = { syncedAt: new Date().toISOString(), orders };
    file.write(cache);
  } catch (err) {
    syncErrors.set(connection.id, err?.message || "Sinhronizacija nije uspela.");
  } finally {
    syncing.delete(connection.id);
  }
}

function isStale(entry) {
  if (!entry) return true;
  return Date.now() - new Date(entry.syncedAt).getTime() > SYNC_MAX_AGE_MS;
}

// Non-blocking: returns whatever is cached right now (possibly empty on
// the very first call for a connection) and kicks off a background sync
// if the cache is missing/stale, without waiting for it to finish.
function readCache(connection) {
  const entry = cache[connection.id];
  if (isStale(entry) && !syncing.has(connection.id)) {
    syncConnection(connection);
  }
  return entry || { syncedAt: null, orders: [] };
}

function getOrdersForConnections(connections) {
  const tagSource = connections.length > 1;
  const entries = connections.map((c) => readCache(c));
  return entries.flatMap((entry, i) =>
    entry.orders.map((o) => ({
      ...o,
      sourceSiteUrl: tagSource ? connections[i].siteUrl : null,
    }))
  );
}

// Only these two statuses count as "stuck" — cancelled/refunded/failed orders
// are already resolved (just not successfully), and completed ones are done.
const STALE_STATUSES = ["pending", "processing"];

function getStaleOrders(connections, { page, perPage }) {
  const thresholdDays = getStaleOrderThresholdDays();
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
  getOrdersForConnections,
  getStaleOrders,
  getSyncStatus,
};
