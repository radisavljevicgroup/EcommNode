const { Router } = require("express");
const { getConnections } = require("../lib/store");
const { getConnections: getShopifyConnections } = require("../lib/shopifyStore");
const { getOrdersPage, getStaleOrders, getUnfiscalizedOrders } = require("../lib/ordersCache");
const {
  isStaleTrackingEnabled,
  isUnfiscalizedTrackingEnabled,
} = require("../lib/settingsStore");
const { adjustCallCount } = require("../lib/orderCallsStore");

const router = Router();

const ALLOWED_PER_PAGE = [10, 20, 30, 50];

// undefined (param omitted) => null => no status filter (all statuses).
// "" (param present but empty, i.e. every checkbox unchecked) => [] => caller
// must treat this as "match nothing" rather than falling back to "all".
function parseStatus(req) {
  if (req.query.status === undefined) return null;
  return req.query.status.split(",").filter(Boolean);
}

router.get("/orders", async (req, res) => {
  const connections = [...getConnections(req.company), ...getShopifyConnections(req.company)];
  if (connections.length === 0) {
    return res.status(401).json({ error: "Nisi povezan ni sa jednom prodavnicom." });
  }

  const { connectionId, search, stale, unfiscalized, fulfillment, fiscal } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = ALLOWED_PER_PAGE.includes(Number(req.query.perPage))
    ? Number(req.query.perPage)
    : 10;
  const status = parseStatus(req);

  // Every status checkbox unchecked — nothing can match.
  if (status !== null && status.length === 0) {
    return res.json({ orders: [], pagination: { page, perPage, total: 0, totalPages: 1 } });
  }

  let targets;
  if (connectionId && connectionId !== "all") {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) {
      return res.status(404).json({ error: "Integracija nije pronađena." });
    }
    targets = [connection];
  } else {
    targets = connections;
  }

  // Stale-orders view reads from the local analytics cache (needs full
  // history to find old un-completed orders) instead of paginating the
  // live WooCommerce API.
  if (stale === "true" || stale === "1") {
    try {
      const result = await getStaleOrders(targets, { page, perPage, company: req.company });
      return res.json(result);
    } catch {
      return res.status(400).json({ error: "Ne mogu da učitam zastarele porudžbine." });
    }
  }

  // Same cache-based approach as the stale view — fiscalization isn't a
  // WooCommerce-native filter, so this can't be paginated live from the API.
  if (unfiscalized === "true" || unfiscalized === "1") {
    try {
      const result = await getUnfiscalizedOrders(targets, { page, perPage });
      return res.json(result);
    } catch {
      return res.status(400).json({ error: "Ne mogu da učitam nefiskalizovane porudžbine." });
    }
  }

  // The main list also reads from the local cache instead of hitting
  // WooCommerce live on every page click — paginating a real API call was
  // slow, especially for "all integrations" which had to fetch a growing
  // prefix from every connected store on every page navigation. The cache
  // is kept warm by the same background sync the stale/unfiscalized/
  // analytics views already rely on.
  try {
    const result = getOrdersPage(targets, { page, perPage, search, status, fulfillment, fiscal });
    res.json(result);
  } catch {
    res.status(400).json({ error: "Ne mogu da učitam porudžbine." });
  }
});

router.get("/orders/stale-count", async (req, res) => {
  if (!isStaleTrackingEnabled(req.company)) return res.json({ count: 0 });
  const connections = [...getConnections(req.company), ...getShopifyConnections(req.company)];
  try {
    const result = await getStaleOrders(connections, { page: 1, perPage: 1, company: req.company });
    res.json({ count: result.pagination.total });
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam broj zastarelih porudžbina." });
  }
});

router.get("/orders/unfiscalized-count", async (req, res) => {
  if (!isUnfiscalizedTrackingEnabled(req.company)) return res.json({ count: 0 });
  const connections = [...getConnections(req.company), ...getShopifyConnections(req.company)];
  try {
    const result = await getUnfiscalizedOrders(connections, { page: 1, perPage: 1 });
    res.json({ count: result.pagination.total });
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam broj nefiskalizovanih porudžbina." });
  }
});

// Manually logged call count for personal-pickup orders — a plus/minus click
// in the UI sends a delta rather than an absolute value, so concurrent clicks
// can't clobber each other.
router.post("/orders/calls", (req, res) => {
  const { connectionId, orderId, delta } = req.body || {};
  if (!connectionId || !orderId || (delta !== 1 && delta !== -1)) {
    return res.status(400).json({ error: "connectionId, orderId i delta (1 ili -1) su obavezni." });
  }
  const count = adjustCallCount(connectionId, String(orderId), delta);
  res.json({ count });
});

module.exports = router;
