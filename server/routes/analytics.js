const { Router } = require("express");
const { getConnections } = require("../lib/store");
const {
  getOrdersForConnections,
  getOrdersForConnectionsTagged,
  getSyncStatus,
  syncConnection,
} = require("../lib/ordersCache");
const { getProductCategoryMap, getCategoryImageMap } = require("../lib/productsCache");
const { getConnections: getGa4Connections } = require("../lib/ga4Store");
const ga4 = require("../lib/ga4");
const analytics = require("../lib/analytics");

const router = Router();

function resolveConnections(req) {
  const all = getConnections();
  const { connectionIds } = req.query;
  if (!connectionIds) return all;
  const ids = connectionIds.split(",").filter(Boolean);
  return all.filter((c) => ids.includes(c.id));
}

// CR isn't a WooCommerce-only number — it needs GA4 sessions for the same
// store, so unlike the rest of analytics.js this can't live there without
// giving that module a GA4 dependency it otherwise doesn't need. Only
// WooCommerce connections that have a GA4 property actually targeting them
// contribute; stores with no GA4 link are silently excluded rather than
// pulling the blended rate toward zero.
function linkedGa4Connections(connections) {
  return getGa4Connections().filter((g) => connections.some((c) => c.id === g.targetConnectionId));
}

async function computeConversionRate(connections, { from, to }) {
  const ga4Connections = linkedGa4Connections(connections);
  if (!ga4Connections.length) return null;

  let totalOrders = 0;
  let totalSessions = 0;

  await Promise.all(
    ga4Connections.map(async (g) => {
      const wooConn = connections.find((c) => c.id === g.targetConnectionId);
      if (!wooConn) return;
      try {
        const [orders, perf] = await Promise.all([
          getOrdersForConnections([wooConn]),
          ga4.getPerformance(g, { from, to }),
        ]);
        const periodOrders = analytics.realized(analytics.filterByRange(orders, from, to));
        totalOrders += periodOrders.length;
        totalSessions += perf.totals.sessions;
      } catch {
        // this store's GA4 fetch failed (auth/quota) — skip it rather than
        // fail the whole summary over one bad connection
      }
    })
  );

  if (totalSessions === 0) return null;
  return (totalOrders / totalSessions) * 100;
}

// Buckets orders onto the exact same day/week/month keys GA4's own trend
// aggregation uses (see aggregateTrend in lib/ga4.js), so the two series
// line up by label without a separate reconciliation step.
function crBucketKey(dateStr, unit) {
  if (unit === "month") return dateStr.slice(0, 7);
  if (unit === "week") return ga4.weekStart(dateStr.slice(0, 10));
  return dateStr.slice(0, 10);
}

async function computeCrTrend(connections, { from, to }) {
  const ga4Connections = linkedGa4Connections(connections);
  if (!ga4Connections.length) return { unit: "day", series: [], currency: "RSD" };

  const spanDays = Math.max((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24), 1);
  const unit = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";

  const sessionsByLabel = new Map();
  const ordersByLabel = new Map();

  await Promise.all(
    ga4Connections.map(async (g) => {
      const wooConn = connections.find((c) => c.id === g.targetConnectionId);
      if (!wooConn) return;
      try {
        const [orders, perf] = await Promise.all([
          getOrdersForConnections([wooConn]),
          ga4.getPerformance(g, { from, to }),
        ]);
        perf.trend.forEach((row) => {
          sessionsByLabel.set(row.date, (sessionsByLabel.get(row.date) || 0) + row.sessions);
        });
        analytics.realized(analytics.filterByRange(orders, from, to)).forEach((o) => {
          const key = crBucketKey(o.dateCreated, unit);
          ordersByLabel.set(key, (ordersByLabel.get(key) || 0) + 1);
        });
      } catch {
        // skip this store's GA4 data on failure
      }
    })
  );

  const labels = [...sessionsByLabel.keys()].sort();
  const series = labels.map((label) => {
    const sessions = sessionsByLabel.get(label) || 0;
    const orders = ordersByLabel.get(label) || 0;
    return { label, value: sessions > 0 ? (orders / sessions) * 100 : 0 };
  });

  return { unit, series, currency: "RSD" };
}

router.get("/analytics/summary", async (req, res) => {
  const connections = resolveConnections(req);
  if (!connections.length) {
    return res.json({
      orderCount: 0,
      cr: null,
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
    const summary = analytics.computeSummary(orders, { from, to });
    summary.cr = await computeConversionRate(connections, { from, to });
    res.json(summary);
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
  "cr",
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
    if (metric === "cr") {
      return res.json(await computeCrTrend(connections, { from, to }));
    }
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
