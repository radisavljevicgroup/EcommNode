// CR isn't a WooCommerce-only number — it needs GA4 sessions for the same
// store, so it lives in its own module rather than analytics.js (which
// otherwise has no GA4 dependency) or routes/analytics.js (which is only
// the "Analitika" page's own summary — this is also needed by the
// homepage dashboard's summary, hence the extraction).
const { getOrdersForConnections } = require("./ordersCache");
const { getConnections: getGa4Connections } = require("./ga4Store");
const ga4 = require("./ga4");
const analytics = require("./analytics");

// Only WooCommerce connections that have a GA4 property actually targeting
// them contribute; stores with no GA4 link are silently excluded rather
// than pulling the blended rate toward zero.
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

module.exports = { linkedGa4Connections, computeConversionRate };
