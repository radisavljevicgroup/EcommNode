const { Router } = require("express");
const { getConnections } = require("../lib/store");
const { getConnections: getShopifyConnections } = require("../lib/shopifyStore");
const {
  getOrdersForConnections,
  getOrdersForConnectionsTagged,
  getSyncStatus,
  syncConnection,
} = require("../lib/ordersCache");
const { getProductCategoryMap, getCategoryImageMap } = require("../lib/productsCache");
const { getConnections: getMetaConnections } = require("../lib/metaStore");
const ga4 = require("../lib/ga4");
const meta = require("../lib/meta");
const analytics = require("../lib/analytics");
const { linkedGa4Connections, computeConversionRate } = require("../lib/conversionRate");

const router = Router();

function resolveConnections(req) {
  const all = [...getConnections(req.company), ...getShopifyConnections(req.company)];
  const { connectionIds } = req.query;
  if (!connectionIds) return all;
  const ids = connectionIds.split(",").filter(Boolean);
  return all.filter((c) => ids.includes(c.id));
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

// CAC, like CR, pulls from a different integration (Meta Ads spend) — a
// Meta connection can target several stores at once (one ad account
// running the whole portfolio), so "linked" means at least one overlap,
// not an exact match.
function linkedMetaConnections(connections, company) {
  return getMetaConnections(company).filter((m) =>
    (m.targetConnectionIds || []).some((id) => connections.some((c) => c.id === id))
  );
}

async function computeCac(connections, allOrders, { from, to, company }) {
  const metaConnections = linkedMetaConnections(connections, company);
  if (!metaConnections.length) return null;

  let totalSpend = 0;
  let currency = null;

  await Promise.all(
    metaConnections.map(async (m) => {
      try {
        const perf = await meta.getPerformance(m, { from, to });
        totalSpend += perf.totals.spend;
        if (!currency) currency = perf.currency;
      } catch {
        // this Meta connection's fetch failed (auth/permission) — skip it
        // rather than fail the whole summary over one bad connection
      }
    })
  );

  const periodOrders = analytics.filterByRange(allOrders, from, to);
  const newCustomers = analytics.newCustomerCount(periodOrders, allOrders, from, to);
  if (newCustomers === 0) return null;

  return { value: totalSpend / newCustomers, currency: currency || "RSD" };
}

async function computeCacTrend(connections, allOrders, { from, to, company }) {
  const metaConnections = linkedMetaConnections(connections, company);
  if (!metaConnections.length) return { unit: "day", series: [], currency: "RSD" };

  const spanDays = Math.max((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24), 1);
  const unit = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";

  const spendByLabel = new Map();
  let currency = null;

  await Promise.all(
    metaConnections.map(async (m) => {
      try {
        const perf = await meta.getPerformance(m, { from, to });
        if (!currency) currency = perf.currency;
        perf.trend.forEach((row) => {
          const key = crBucketKey(row.date, unit);
          spendByLabel.set(key, (spendByLabel.get(key) || 0) + row.spend);
        });
      } catch {
        // skip this Meta connection's data on failure
      }
    })
  );

  // Bucketed by each customer's first-ever order date, not by every order
  // in the period — matches computeCac's "new customer" definition.
  const customersByLabel = new Map();
  const history = analytics.groupByCustomer(allOrders);
  history.forEach((hist) => {
    if (!hist.length) return;
    const firstOrder = hist.reduce((earliest, o) =>
      new Date(o.dateCreated) < new Date(earliest.dateCreated) ? o : earliest
    );
    if (!analytics.inRange(firstOrder.dateCreated, from, to)) return;
    const key = crBucketKey(firstOrder.dateCreated, unit);
    customersByLabel.set(key, (customersByLabel.get(key) || 0) + 1);
  });

  const labels = [...new Set([...spendByLabel.keys(), ...customersByLabel.keys()])].sort();
  const series = labels.map((label) => {
    const spend = spendByLabel.get(label) || 0;
    const customers = customersByLabel.get(label) || 0;
    return { label, value: customers > 0 ? spend / customers : 0 };
  });

  return { unit, series, currency: currency || "RSD" };
}

// Same shape/reasoning as dashboard.js's changePercent — that copy compares
// a period to the one immediately before it, this one to the same period a
// year back, but the arithmetic (and the null-guarding) is identical.
function changePercent(current, previous) {
  if (current === null || current === undefined) return null;
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

const SUMMARY_METRIC_KEYS = [
  "orderCount",
  "cr",
  "aov",
  "upt",
  "shippingPercent",
  "rpr",
  "ltv",
  "tbo",
  "clv",
  "cac",
  "ofct",
  "returnRate",
];

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
      cac: null,
      cacCurrency: null,
      ofct: 0,
      returnRate: 0,
      currency: "RSD",
    });
  }
  try {
    const orders = await getOrdersForConnections(connections);
    const { from, to, compare } = req.query;
    const summary = analytics.computeSummary(orders, { from, to });

    if (compare === "true" || compare === "1") {
      // "Isti period / isti mesec / isti dan" all reduce to the exact same
      // operation server-side — the frontend just sends a different [from,
      // to] depending on which of the three the merchant picked (see
      // SalesAnalysis.jsx). Reusing `orders` here (not a second store
      // fetch) is the same reasoning ltv/rpr/tbo/clv already rely on: it's
      // the full order history, already covers any date window.
      const prevFrom = from ? analytics.shiftYears(from, -1) : null;
      const prevTo = to ? analytics.shiftYears(to, -1) : null;
      const prevSummary = analytics.computeSummary(orders, { from: prevFrom, to: prevTo });

      const [[crCurr, crPrev], [cacCurrResult, cacPrevResult]] = await Promise.all([
        Promise.all([
          computeConversionRate(connections, { from, to }),
          computeConversionRate(connections, { from: prevFrom, to: prevTo }),
        ]),
        Promise.all([
          computeCac(connections, orders, { from, to, company: req.company }),
          computeCac(connections, orders, { from: prevFrom, to: prevTo, company: req.company }),
        ]),
      ]);
      summary.cr = crCurr;
      prevSummary.cr = crPrev;
      summary.cac = cacCurrResult?.value ?? null;
      summary.cacCurrency = cacCurrResult?.currency ?? null;
      prevSummary.cac = cacPrevResult?.value ?? null;
      prevSummary.cacCurrency = cacPrevResult?.currency ?? null;

      summary.changePercent = {};
      SUMMARY_METRIC_KEYS.forEach((key) => {
        summary.changePercent[key] = changePercent(summary[key], prevSummary[key]);
      });
      // Raw previous-period values, not just the delta — the "Poređenje sa
      // prošlom godinom" section (SalesAnalysis.jsx) shows both years' real
      // numbers side by side, not a single value with an up/down badge.
      summary.previous = {
        ...Object.fromEntries(SUMMARY_METRIC_KEYS.map((key) => [key, prevSummary[key]])),
        cacCurrency: prevSummary.cacCurrency,
        currency: prevSummary.currency,
      };
    } else {
      summary.cr = await computeConversionRate(connections, { from, to });
      const cacResult = await computeCac(connections, orders, { from, to, company: req.company });
      summary.cac = cacResult?.value ?? null;
      summary.cacCurrency = cacResult?.currency ?? null;
    }

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

// Backs the "Poređenje sa prošlom godinom" section (SalesAnalysis.jsx) —
// fully independent of /analytics/summary|trends above and whatever [from,
// to] the main filters are set to. Granularity isn't tied to which of
// "Isti period/mesec/dan" picked the range — it's derived from how long
// the resulting [from, to] actually spans, so "Isti period" (a free custom
// range) gets the same drill-down a merchant would expect at any scale:
// a year-ish range breaks down by month, a month-ish range by day, and a
// single day by hour (which "Isti dan" always lands on, since from===to).
const DAY_MS = 24 * 60 * 60 * 1000;

function pickGranularity(from, to) {
  if (!from || !to) return "monthly";
  const spanDays = Math.round((new Date(to) - new Date(from)) / DAY_MS) + 1;
  if (spanDays <= 1) return "hourly";
  if (spanDays <= 31) return "daily";
  return "monthly";
}

router.get("/analytics/yoy-trends", async (req, res) => {
  const connections = resolveConnections(req);
  if (!connections.length) {
    return res.json({ series: [], yoyPercent: null, currentTotal: 0, previousTotal: 0, granularity: "daily" });
  }
  try {
    const orders = await getOrdersForConnections(connections);
    const { from, to } = req.query;
    const granularity = pickGranularity(from, to);

    const result =
      granularity === "hourly"
        ? analytics.computeHourlyTrends(orders, { day: from })
        : granularity === "monthly"
        ? analytics.computeTrends(orders, { from, to })
        : analytics.computeDailyTrends(orders, { from, to });

    res.json({ ...result, granularity });
  } catch {
    res.status(400).json({ error: "Ne mogu da izračunam poređenje." });
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
  "cac",
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
    if (metric === "cac") {
      return res.json(await computeCacTrend(connections, orders, { from, to, company: req.company }));
    }
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
