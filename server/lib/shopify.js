const SHOPIFY_API_VERSION = "2024-01";
const PAGE_LIMIT = 250;
// Safety cap on pagination loops — same reasoning as WooCommerce's
// MAX_SYNC_PAGES (ordersCache.js/productsCache.js): bounds a single sync
// run even for a store with an unexpectedly large history.
const MAX_PAGES = 50;

function normalizeShopDomain(input) {
  let domain = String(input || "").trim();
  domain = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!domain) return "";
  if (!domain.endsWith(".myshopify.com")) {
    domain = `${domain}.myshopify.com`;
  }
  return domain.toLowerCase();
}

function baseUrl(connection, resource) {
  return `https://${connection.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/${resource}.json`;
}

// Same reasoning as WooCommerce's client timeout (server/lib/woocommerce.js)
// — without one, a stalled request hangs fetchAllPages' loop forever,
// leaving that store's sync stuck in "syncing" with no error and no
// fresh data.
const REQUEST_TIMEOUT_MS = 30000;

async function shopifyFetch(url, connection) {
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": connection.accessToken,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return res;
}

// Shopify's REST API paginates via a cursor in the `Link` response header
// (`?page_info=...`) — the `page`/`per_page` query params WooCommerce uses
// are no longer supported. Parses out the "next" page URL, if any.
function nextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));
  if (!match) return null;
  const urlMatch = match.match(/^<([^>]+)>/);
  return urlMatch ? urlMatch[1] : null;
}

async function testShopifyConnection(connection) {
  const res = await shopifyFetch(baseUrl(connection, "shop"), connection);
  if (!res.ok) {
    const err = new Error(`Shopify API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.shop;
}

async function fetchAllPages(connection, resource, params, key) {
  const items = [];
  let url = `${baseUrl(connection, resource)}?${new URLSearchParams(params).toString()}`;
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    // eslint-disable-next-line no-await-in-loop
    const res = await shopifyFetch(url, connection);
    if (!res.ok) {
      const err = new Error(`Shopify API returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    // eslint-disable-next-line no-await-in-loop
    const data = await res.json();
    items.push(...(data[key] || []));
    url = nextPageUrl(res.headers.get("link"));
    pages += 1;
  }

  return items;
}

async function fetchAllShopifyOrdersRaw(connection, { sinceMonths } = {}) {
  const createdAtMin = new Date();
  createdAtMin.setMonth(createdAtMin.getMonth() - (sinceMonths || 14));
  return fetchAllPages(
    connection,
    "orders",
    { status: "any", limit: PAGE_LIMIT, created_at_min: createdAtMin.toISOString() },
    "orders"
  );
}

async function fetchAllShopifyProductsRaw(connection) {
  return fetchAllPages(connection, "products", { limit: PAGE_LIMIT }, "products");
}

module.exports = {
  SHOPIFY_API_VERSION,
  normalizeShopDomain,
  testShopifyConnection,
  fetchAllShopifyOrdersRaw,
  fetchAllShopifyProductsRaw,
};
