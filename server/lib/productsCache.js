const { createJsonFile } = require("./jsonFile");
const { createWooClient } = require("./woocommerce");

const file = createJsonFile("products-cache.json", {});
let cache = file.read();

const SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — categories rarely change
const WC_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = 30; // safety cap, same reasoning as ordersCache

const syncing = new Set();

async function fetchAllProducts(connection) {
  const client = createWooClient(connection);
  const products = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get("products", { page, per_page: WC_PAGE_SIZE });
    products.push(
      ...response.data.map((p) => ({
        id: p.id,
        name: p.name,
        categories: (p.categories || []).map((c) => c.name),
      }))
    );
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0 || page >= MAX_SYNC_PAGES) break;
    page += 1;
  }
  return products;
}

async function syncConnection(connection) {
  if (syncing.has(connection.id)) return;
  syncing.add(connection.id);
  try {
    const products = await fetchAllProducts(connection);
    cache[connection.id] = { syncedAt: new Date().toISOString(), products };
    file.write(cache);
  } catch {
    // leave the previous cache entry (if any) in place; next stale check retries
  } finally {
    syncing.delete(connection.id);
  }
}

function isStale(entry) {
  if (!entry) return true;
  return Date.now() - new Date(entry.syncedAt).getTime() > SYNC_MAX_AGE_MS;
}

function getProductCategoryMap(connections) {
  const map = new Map();
  connections.forEach((connection) => {
    const entry = cache[connection.id];
    if (isStale(entry) && !syncing.has(connection.id)) {
      syncConnection(connection); // fire and forget
    }
    (entry?.products || []).forEach((p) => map.set(p.id, p.categories));
  });
  return map;
}

module.exports = { getProductCategoryMap };
