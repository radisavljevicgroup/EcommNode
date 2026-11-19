const { createJsonFile } = require("./jsonFile");
const { createWooClient } = require("./woocommerce");
const { fetchAllShopifyProductsRaw } = require("./shopify");

const file = createJsonFile("products-cache.json", {});
let cache = file.read();

const SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — categories rarely change
const WC_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = 30; // safety cap, same reasoning as ordersCache
const MAX_VARIATION_PAGES = 10; // per product — generous, variations rarely exceed a page

// Same limits as the Eurocom/stock-control fetchers: firing one variation
// request per variable product with no cap (up to 100 at once, via
// Promise.all) exhausted the shared host's MySQL connections — 2026-11-19
// the papagaj/maped/rotring stores (one cPanel account, one DB server)
// answered those bursts with 500s and reset connections, which also broke
// the Eurocom diff ("read ECONNRESET") running against the same host.
const VARIATION_CONCURRENCY = 2;
const PRODUCT_FIELDS = "id,name,sku,type,categories";
const VARIATION_FIELDS = "id,sku";
// A failed sync used to leave the entry stale, so every analytics request
// started the whole fetch again right away — and failed again under its own
// load. Wait this long after a failure before retrying.
const FAILURE_BACKOFF_MS = 30 * 60 * 1000;

const syncing = new Set();
const lastFailureAt = new Map();

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      // eslint-disable-next-line no-await-in-loop
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Variable products carry their own (usually SKU-less) product record, plus
// one variation per combination of attributes (size/color/...) — each
// variation has its own SKU and is a separate WooCommerce resource that
// isn't included in GET /products, so it needs its own fetch per product.
async function fetchVariations(client, productId) {
  const variations = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get(`products/${productId}/variations`, {
      page,
      per_page: WC_PAGE_SIZE,
      _fields: VARIATION_FIELDS,
    });
    variations.push(
      ...response.data.map((v) => ({
        id: v.id,
        parentId: productId,
        sku: v.sku || "",
      }))
    );
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0 || page >= MAX_VARIATION_PAGES) break;
    page += 1;
  }
  return variations;
}

async function fetchAllProducts(connection) {
  const client = createWooClient(connection);
  const products = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get("products", {
      page,
      per_page: WC_PAGE_SIZE,
      _fields: PRODUCT_FIELDS,
    });
    // eslint-disable-next-line no-await-in-loop
    const withVariations = await mapWithConcurrency(
      response.data,
      VARIATION_CONCURRENCY,
      async (p) => {
        const categories = (p.categories || []).map((c) => c.name);
        const entries = [{ id: p.id, name: p.name, sku: p.sku || "", categories }];
        if (p.type === "variable") {
          const variations = await fetchVariations(client, p.id);
          // A variation's own name/categories aren't separate WooCommerce
          // concepts — they inherit the parent's for display/matching.
          variations.forEach((v) =>
            entries.push({ ...v, name: p.name, categories })
          );
        }
        return entries;
      }
    );
    products.push(...withVariations.flat());
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0 || page >= MAX_SYNC_PAGES) break;
    page += 1;
  }
  return products;
}

// Category images aren't on the product resource — a separate endpoint.
async function fetchAllCategories(connection) {
  const client = createWooClient(connection);
  const categories = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get("products/categories", {
      page,
      per_page: WC_PAGE_SIZE,
    });
    categories.push(
      ...response.data.map((c) => ({ id: c.id, name: c.name, image: c.image?.src || null }))
    );
    const totalPages = Number(response.headers?.["x-wp-totalpages"] || 1);
    if (page >= totalPages || response.data.length === 0 || page >= MAX_SYNC_PAGES) break;
    page += 1;
  }
  return categories;
}

// Shopify products carry their variants (with SKUs) inline in the same
// response, unlike WooCommerce which needs a separate per-product
// variation fetch — and product_type is the closest equivalent to a Woo
// category, though it has no associated image (no fetchAllCategories
// equivalent — getCategoryImageMap simply has no entries for Shopify).
async function fetchAllShopifyProducts(connection) {
  const products = await fetchAllShopifyProductsRaw(connection);
  return products.map((p) => ({
    id: p.id,
    name: p.title,
    sku: p.variants?.[0]?.sku || "",
    categories: p.product_type ? [p.product_type] : [],
  }));
}

async function syncConnection(connection) {
  if (syncing.has(connection.id)) return;
  syncing.add(connection.id);
  try {
    if (connection.platform === "shopify") {
      const products = await fetchAllShopifyProducts(connection);
      cache[connection.id] = { syncedAt: new Date().toISOString(), products, categories: [] };
    } else {
      const [products, categories] = await Promise.all([
        fetchAllProducts(connection),
        fetchAllCategories(connection),
      ]);
      cache[connection.id] = { syncedAt: new Date().toISOString(), products, categories };
    }
    file.write(cache);
    lastFailureAt.delete(connection.id);
  } catch (err) {
    // Leave the previous cache entry (if any) in place; retried after
    // FAILURE_BACKOFF_MS, not on the very next request.
    lastFailureAt.set(connection.id, Date.now());
    console.error(`[products-cache] ${connection.siteUrl}: ${err.message}`);
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
    const failedAt = lastFailureAt.get(connection.id);
    const backingOff = failedAt && Date.now() - failedAt < FAILURE_BACKOFF_MS;
    if (isStale(entry) && !syncing.has(connection.id) && !backingOff) {
      syncConnection(connection); // fire and forget
    }
    (entry?.products || []).forEach((p) => map.set(p.id, p.categories));
  });
  return map;
}

// Keyed by site+name, not name alone — the same category name in two
// different stores is two different categories with two different images.
function getCategoryImageMap(connections) {
  const map = new Map();
  connections.forEach((connection) => {
    const entry = cache[connection.id];
    (entry?.categories || []).forEach((c) => {
      if (c.image) map.set(`${connection.siteUrl}::${c.name}`, c.image);
    });
  });
  return map;
}

module.exports = {
  getProductCategoryMap,
  getCategoryImageMap,
};
