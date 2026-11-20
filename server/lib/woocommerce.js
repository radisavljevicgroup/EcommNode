const dns = require("dns");
const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

// Without a timeout, a single slow/unresponsive page request to the live
// store hangs this call forever — which, inside the sync loop, means the
// whole sync never finishes: `syncing` stays true permanently, cached
// orders go stale, and there's no error to even show why.
const REQUEST_TIMEOUT_MS = 30000;

// Shared cap on simultaneous WooCommerce requests per target SERVER (by
// resolved IP), across every module and every store. All the merchant's
// stores (papagaj, maped, rotring, parker, waterman...) are addon domains
// on one shared host (s56.unlimited.rs), and its LiteSpeed has a
// server-wide per-client-IP limit: on 2026-11-19 a ~60-request burst got
// our API's IP temporarily banned (BOT_OVER_HARD) for ALL stores at once,
// which showed up everywhere as "read ECONNRESET". Per-module limits
// (Eurocom, stock-control...) don't help when several modules and stores
// hit the same host at the same moment — this one does.
const MAX_CONCURRENT_PER_HOST = 4;
const DNS_CACHE_MS = 10 * 60 * 1000;

const dnsCache = new Map(); // hostname -> { key, at }
const limiters = new Map(); // ip (or hostname if lookup fails) -> { active, queue }

async function hostKey(hostname) {
  const cached = dnsCache.get(hostname);
  if (cached && Date.now() - cached.at < DNS_CACHE_MS) return cached.key;
  let key = hostname;
  try {
    key = (await dns.promises.lookup(hostname)).address;
  } catch {
    // fall back to the hostname — still limits that one store
  }
  dnsCache.set(hostname, { key, at: Date.now() });
  return key;
}

async function withHostSlot(hostname, fn) {
  const key = await hostKey(hostname);
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = { active: 0, queue: [] };
    limiters.set(key, limiter);
  }
  if (limiter.active >= MAX_CONCURRENT_PER_HOST) {
    await new Promise((resolve) => limiter.queue.push(resolve));
  } else {
    limiter.active += 1;
  }
  try {
    return await fn();
  } finally {
    // Hand the slot straight to the next waiter (active stays the same),
    // or free it.
    const next = limiter.queue.shift();
    if (next) next();
    else limiter.active -= 1;
  }
}

function createWooClient({ siteUrl, consumerKey, consumerSecret }) {
  const client = new WooCommerceRestApi({
    url: siteUrl,
    consumerKey,
    consumerSecret,
    version: "wc/v3",
    queryStringAuth: true,
    timeout: REQUEST_TIMEOUT_MS,
  });
  let hostname = siteUrl;
  try {
    hostname = new URL(siteUrl).hostname;
  } catch {
    // keep siteUrl as the key
  }
  ["get", "post", "put", "delete", "options"].forEach((method) => {
    const original = client[method].bind(client);
    client[method] = (...args) => withHostSlot(hostname, () => original(...args));
  });
  return client;
}

module.exports = { createWooClient };
