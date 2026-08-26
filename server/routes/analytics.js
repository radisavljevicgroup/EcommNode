const { Router } = require("express");
const { getConnections } = require("../lib/store");
const {
  getOrdersForConnections,
  getOrdersForConnectionsTagged,
  getSyncStatus,
  syncConnection,
} = require("../lib/ordersCache");
const { getProductCategoryMap, getCategoryImageMap } = require("../lib/productsCache");
const analytics = require("../lib/analytics");

const router = Router();

function resolveConnections(req) {
  const all = getConnections();
  const { connectionIds } = req.query;
  if (!connectionIds) return all;
  const ids = connectionIds.split(",").filter(Boolean);
  return all.filter((c) => ids.includes(c.id));
}

router.get("/analytics/summary", async (req, res) => {
  const connections = resolveConnections(req);
  if (!connections.length) {
    return res.json({
      orderCount: 0,
      aov: 0,
      upt: 0,
      shippingPercent: 0,
      rpr: 0,
      ltv: 0,
      tbo: 0,
      clv: 0,
      ofct: 0,
      returnRate: 0,
      currency: "RSD",
    });
  }
  try {
    const orders = await getOrdersForConnections(connections);
    const { from, to } = req.query;
    res.json(analytics.computeSummary(orders, { from, to }));
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam analitiku." });
  }
});

router.get("/analytics/trends", async (req, res) => {
  const connections = resolveConnections(req);
  if (!connections.length) {
    return res.json({ series: [], yoyPercent: null, currentTotal: 0, previousTotal: 0 });
  }
  try {
    const orders = await getOrdersForConnections(connections);
    const { from, to } = req.query;
    res.json(analytics.computeTrends(orders, { from, to }));
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam trendove." });
  }
});

router.get("/analytics/top-products", async (req, res) => {
  const connections = resolveConnections(req);
  if (!connections.length) {
    return res.json({ bestsellers: [], slowMovers: [], categories: [] });
  }
  try {
    const orders = getOrdersForConnectionsTagged(connections);
    const categoryMap = getProductCategoryMap(connections);
    const categoryImageMap = getCategoryImageMap(connections);
    const { from, to, sortBy } = req.query;
    res.json(
      analytics.computeTopProducts(orders, { from, to, sortBy }, categoryMap, categoryImageMap)
    );
  } catch {
    res.status(400).json({ error: "Ne mogu da učitam top proizvode." });
  }
});

router.get("/analytics/geo", async (req, res) => {
  const connections = resolveConnections(req);
  if (!connections.length) return res.json([]);
  try {
    const orders = await getOrdersForConnections(connections);
    const { from, to } = req.query;
    res.json(analytics.computeGeoDistribution(orders, { from, to }));
  } catch {
    res.status(400).json({ error: "Ne mogu da učitam geografsku raspodelu." });
  }
});

const METRIC_KEYS = new Set([
  "orderCount",
  "aov",
  "upt",
  "shippingPercent",
  "rpr",
  "ltv",
  "tbo",
  "clv",
  "ofct",
  "returnRate",
]);

router.get("/analytics/metric-trend", async (req, res) => {
  const { metric, from, to } = req.query;
  if (!METRIC_KEYS.has(metric)) {
    return res.status(400).json({ error: "Nepoznata metrika." });
  }
  const connections = resolveConnections(req);
  if (!connections.length || !from || !to) {
    return res.json({ unit: "day", series: [], currency: "RSD" });
  }
  try {
    const orders = await getOrdersForConnections(connections);
    res.json(analytics.computeMetricTrend(orders, { from, to }, metric));
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam trend metrike." });
  }
});

router.get("/analytics/sync-status", (req, res) => {
  res.json({ connections: getSyncStatus(resolveConnections(req)) });
});

router.post("/analytics/sync", (req, res) => {
  const connections = resolveConnections(req);
  // Fire-and-forget: a full sync can take minutes on large stores, so this
  // just kicks it off in the background. The client polls /sync-status.
  connections.forEach((c) => syncConnection(c));
  res.json({ started: true });
});

module.exports = router;
