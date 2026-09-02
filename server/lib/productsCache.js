const { createJsonFile } = require("./jsonFile");
const { createWooClient } = require("./woocommerce");
const { fetchAllShopifyProductsRaw } = require("./shopify");

const file = createJsonFile("products-cache.json", {});
let cache = file.read();

const SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — categories rarely change
const WC_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = 30; // safety cap, same reasoning as ordersCache
const MAX_VARIATION_PAGES = 10; // per product — generous, variations rarely exceed a page

const syncing = new Set();

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
    const response = await client.get("products", { page, per_page: WC_PAGE_SIZE });
    // eslint-disable-next-line no-await-in-loop
    const withVariations = await Promise.all(
      response.data.map(async (p) => {
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
      })
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
