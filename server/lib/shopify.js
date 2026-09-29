const shopifyStore = require("./shopifyStore");

// Shopify retires each stable API version ~12 months after release — 2024-01
// was retired in Jan 2025, so every call in this file had been failing with
// 401s for a long time before this was caught. Bump this periodically; see
// https://shopify.dev/docs/api/usage/versioning for the current window.
const SHOPIFY_API_VERSION = "2026-07";
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

// Since Jan 1, 2026 Shopify no longer lets a merchant generate a static
// Admin API access token for a NEW custom app from the Store Admin — custom
// apps are now created in the Dev Dashboard and only expose a Client ID +
// Client Secret, exchanged for a token via the client credentials grant
// (https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin).
// That token expires after 24h, so it's cached on the connection and
// refreshed on demand. Connections created before that change still carry a
// long-lived static accessToken with no clientId/clientSecret and never hit
// this path.
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

async function exchangeClientCredentials(connection) {
  const res = await fetch(`https://${connection.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      client_id: connection.clientId,
      client_secret: connection.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    const err = new Error(`Shopify token exchange returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const tokenExpiresAt = Date.now() + (data.expires_in || 0) * 1000;
  connection.accessToken = data.access_token;
  connection.tokenExpiresAt = tokenExpiresAt;
  if (connection.id && connection.company) {
    shopifyStore.updateConnection(connection.id, connection.company, {
      accessToken: data.access_token,
      tokenExpiresAt,
    });
  }
  return data.access_token;
}

async function resolveAccessToken(connection) {
  if (!connection.clientId || !connection.clientSecret) {
    return connection.accessToken;
  }
  if (
    connection.accessToken &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt - Date.now() > TOKEN_SAFETY_MARGIN_MS
  ) {
    return connection.accessToken;
  }
  return exchangeClientCredentials(connection);
}

async function shopifyFetch(url, connection) {
  const accessToken = await resolveAccessToken(connection);
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
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

// The only Shopify write path in this codebase so far (everything else is
// read-only fetches) — kept here rather than in a premium module since any
// future tool that needs to push a product change back to Shopify should
// reuse this instead of re-deriving the auth/timeout headers.
async function updateShopifyProduct(connection, productId, patch) {
  const url = baseUrl(connection, `products/${productId}`);
  const accessToken = await resolveAccessToken(connection);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({ product: { id: productId, ...patch } }),
  });
  if (!res.ok) {
    const err = new Error(`Shopify API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.product;
}

module.exports = {
  SHOPIFY_API_VERSION,
  normalizeShopDomain,
  testShopifyConnection,
  fetchAllShopifyOrdersRaw,
  fetchAllShopifyProductsRaw,
  updateShopifyProduct,
};
