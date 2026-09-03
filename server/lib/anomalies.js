// Rule-based anomaly scan for the homepage "Gde gubimo novac" section.
// Every check compares the current period against the immediately
// preceding period of equal length, and only fires past a threshold big
// enough to not be noise from small sample sizes. None of these claim to
// know *why* a number moved — WooCommerce/GA4/Meta data can't tell us
// that — so messages describe what changed and, where it's a plausible
// next step, suggest what to check rather than asserting a cause.
const { getConnections: getWooConnections } = require("./store");
const { getConnections: getShopifyConnections } = require("./shopifyStore");
const { getConnections: getGa4Connections } = require("./ga4Store");
const { getConnections: getMetaConnections } = require("./metaStore");
const { getOrdersForConnections } = require("./ordersCache");
const ga4 = require("./ga4");
const meta = require("./meta");
const analytics = require("./analytics");

function siteLabel(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    return url;
  }
}

const CR_DROP_MIN_RELATIVE = 0.2; // flag at a 20%+ relative drop
const CR_DROP_CRITICAL_RELATIVE = 0.4;
const CR_MIN_PREVIOUS = 0.3; // ignore stores whose prior CR was already near-zero (all noise)
const CPA_SPIKE_MIN_RELATIVE = 0.25;
const CPA_SPIKE_CRITICAL_RELATIVE = 0.5;
const CPA_MIN_SPEND = 20; // ignore campaigns too small for a % change to mean anything
const FAILED_PAYMENTS_MIN_COUNT = 3;
const FAILED_PAYMENTS_CRITICAL_COUNT = 10;

// Every detector is scoped to `storeConnections` — the brand filter's
// currently-selected store(s), or every connected store when none is
// selected — so a GA4/Meta connection targeting a *different* brand's store
// never surfaces an anomaly while looking at this one.
async function detectConversionDrops({ from, to, prevFrom, prevTo, storeConnections, company }) {
  const ga4Connections = getGa4Connections(company);
  const anomalies = [];

  await Promise.all(
    ga4Connections.map(async (g) => {
      const wooConn = storeConnections.find((c) => c.id === g.targetConnectionId);
      if (!wooConn) return;
      try {
        const [orders, perfCurr, perfPrev] = await Promise.all([
          getOrdersForConnections([wooConn]),
          ga4.getPerformance(g, { from, to }),
          ga4.getPerformance(g, { from: prevFrom, to: prevTo }),
        ]);

        const ordersCurr = analytics.realized(analytics.filterByRange(orders, from, to));
        const ordersPrev = analytics.realized(analytics.filterByRange(orders, prevFrom, prevTo));
        const sessionsCurr = perfCurr.totals.sessions;
        const sessionsPrev = perfPrev.totals.sessions;
        if (!sessionsCurr || !sessionsPrev) return;

        const crCurr = (ordersCurr.length / sessionsCurr) * 100;
        const crPrev = (ordersPrev.length / sessionsPrev) * 100;
        if (crPrev < CR_MIN_PREVIOUS) return;

        const relativeDrop = (crPrev - crCurr) / crPrev;
        if (relativeDrop < CR_DROP_MIN_RELATIVE) return;

        const revenueCurr = ordersCurr.reduce((s, o) => s + parseFloat(o.total || 0), 0);
        const aovCurr = ordersCurr.length ? revenueCurr / ordersCurr.length : 0;
        // "Missing" orders: how many more the current traffic would have
        // produced at the old (higher) rate, valued at the current AOV.
        const missingOrders = (sessionsCurr * (crPrev - crCurr)) / 100;
        const estimatedImpact = missingOrders > 0 ? missingOrders * aovCurr : null;

        anomalies.push({
          id: `cr-${wooConn.id}`,
          category: "conversion",
          severity: relativeDrop >= CR_DROP_CRITICAL_RELATIVE ? "critical" : "warning",
          message: `Stopa konverzije (CR) na ${siteLabel(wooConn.siteUrl)} pala sa ${crPrev.toFixed(1)}% na ${crCurr.toFixed(1)}% — vredi proveriti proces plaćanja/checkout.`,
          estimatedImpact,
          currency: orders[0]?.currency || null,
        });
      } catch {
        // this store's GA4/orders fetch failed — skip it, not the whole scan
      }
    })
  );

  return anomalies;
}

function linkedMetaConnections(storeConnections, company) {
  return getMetaConnections(company).filter((m) =>
    (m.targetConnectionIds || []).some((id) => storeConnections.some((c) => c.id === id))
  );
}

async function detectCpaSpikes({ from, to, prevFrom, prevTo, storeConnections, company }) {
  const metaConnections = linkedMetaConnections(storeConnections, company);
  const anomalies = [];

  await Promise.all(
    metaConnections.map(async (m) => {
      try {
        const [perfCurr, perfPrev] = await Promise.all([
          meta.getPerformance(m, { from, to }),
          meta.getPerformance(m, { from: prevFrom, to: prevTo }),
        ]);
        const prevByCampaign = new Map(perfPrev.topCampaigns.map((c) => [c.campaign, c]));

        perfCurr.topCampaigns.forEach((c) => {
          if (c.spend < CPA_MIN_SPEND || !c.purchases) return;
          const prevC = prevByCampaign.get(c.campaign);
          if (!prevC || !prevC.purchases) return;

          const cpaCurr = c.spend / c.purchases;
          const cpaPrev = prevC.spend / prevC.purchases;
          if (!cpaPrev) return;

          const relativeIncrease = (cpaCurr - cpaPrev) / cpaPrev;
          if (relativeIncrease < CPA_SPIKE_MIN_RELATIVE) return;

          anomalies.push({
            id: `cpa-${m.id}-${c.campaign}`,
            category: "ad-cost",
            severity: relativeIncrease >= CPA_SPIKE_CRITICAL_RELATIVE ? "critical" : "warning",
            message: `Meta trošak po porudžbini (CPA) skočio za ${Math.round(relativeIncrease * 100)}% na kampanji "${c.campaign}" (sa ${cpaPrev.toFixed(0)} na ${cpaCurr.toFixed(0)} ${perfCurr.currency || ""}).`,
            estimatedImpact: (cpaCurr - cpaPrev) * c.purchases,
            currency: perfCurr.currency || null,
          });
        });
      } catch {
        // this Meta connection's fetch failed — skip it
      }
    })
  );

  return anomalies;
}

async function detectFailedPayments({ from, to, storeConnections }) {
  if (!storeConnections.length) return [];

  const orders = await getOrdersForConnections(storeConnections);
  const fromT = new Date(from).getTime();
  const toT = new Date(to).getTime();
  const failed = orders.filter((o) => {
    if (o.status !== "failed") return false;
    const t = new Date(o.dateCreated).getTime();
    return t >= fromT && t <= toT;
  });
  if (!failed.length) return [];

  const windowHours = Math.round((toT - fromT) / (1000 * 60 * 60));
  const byProduct = new Map();
  failed.forEach((o) => {
    const name = o.items?.[0]?.name || "Nepoznat proizvod";
    byProduct.set(name, (byProduct.get(name) || 0) + 1);
  });

  const anomalies = [];
  byProduct.forEach((count, name) => {
    if (count < FAILED_PAYMENTS_MIN_COUNT) return;
    anomalies.push({
      id: `failed-${name}`,
      category: "payments",
      severity: count >= FAILED_PAYMENTS_CRITICAL_COUNT ? "critical" : "warning",
      message: `Registrovano ${count} neuspešnih plaćanja u poslednja ${windowHours}h na proizvodu ${name}.`,
      estimatedImpact: null,
      currency: null,
    });
  });

  // No single product stands out, but the overall count still does —
  // still worth a flag, just without pinning it on one product.
  if (!anomalies.length && failed.length >= FAILED_PAYMENTS_MIN_COUNT) {
    anomalies.push({
      id: "failed-general",
      category: "payments",
      severity: failed.length >= FAILED_PAYMENTS_CRITICAL_COUNT ? "critical" : "warning",
      message: `Registrovano ${failed.length} neuspešnih plaćanja u poslednja ${windowHours}h.`,
      estimatedImpact: null,
      currency: null,
    });
  }

  return anomalies;
}

async function detectAnomalies({ from, to, prevFrom, prevTo, connectionId, company }) {
  const allStoreConnections = [...getWooConnections(company), ...getShopifyConnections(company)];
  const storeConnections = connectionId
    ? allStoreConnections.filter((c) => c.id === connectionId)
    : allStoreConnections;

  const [crDrops, cpaSpikes, failedPayments] = await Promise.all([
    detectConversionDrops({ from, to, prevFrom, prevTo, storeConnections, company }),
    detectCpaSpikes({ from, to, prevFrom, prevTo, storeConnections, company }),
    detectFailedPayments({ from, to, storeConnections }),
  ]);

  const severityRank = { critical: 0, warning: 1 };
  return [...crDrops, ...cpaSpikes, ...failedPayments].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity]
  );
}

module.exports = { detectAnomalies };
