const { Router } = require("express");
const { getConnections: getWooConnections } = require("../lib/store");
const { getConnections: getShopifyConnections } = require("../lib/shopifyStore");
const { getConnections: getMetaConnections } = require("../lib/metaStore");
const { getOrdersForConnections } = require("../lib/ordersCache");
const { computeConversionRate } = require("../lib/conversionRate");
const { detectAnomalies } = require("../lib/anomalies");
const fx = require("../lib/currency");
const meta = require("../lib/meta");
const analytics = require("../lib/analytics");

const router = Router();

const DEFAULT_DAYS = 7;
const DAY_MS = 1000 * 60 * 60 * 24;

// Current period = the last N days up to now; previous period = the N
// days immediately before that — "ove nedelje vs. prošle nedelje" for the
// default 7-day window, but works for any window the homepage asks for.
function periodBounds(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - days * DAY_MS);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    prevFrom: prevFrom.toISOString(),
    prevTo: prevTo.toISOString(),
  };
}

function changePercent(current, previous) {
  if (current === null || current === undefined) return null;
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function periodRevenueOrders(allOrders, from, to) {
  const periodOrders = analytics.realized(analytics.filterByRange(allOrders, from, to));
  const revenue = periodOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  return { revenue, orders: periodOrders.length, aov: periodOrders.length ? revenue / periodOrders.length : 0 };
}

// Only Meta connections actually targeting one of the brand-filtered
// stores contribute — a brand's dashboard must never blend in another
// brand's ad spend just because both happen to be connected.
function linkedMetaConnections(storeConnections) {
  return getMetaConnections().filter((m) =>
    (m.targetConnectionIds || []).some((id) => storeConnections.some((c) => c.id === id))
  );
}

function resolveStoreConnections(connectionId) {
  const all = [...getWooConnections(), ...getShopifyConnections()];
  return connectionId ? all.filter((c) => c.id === connectionId) : all;
}

router.get("/dashboard/summary", async (req, res) => {
  const days = Number(req.query.days) || DEFAULT_DAYS;
  const { from, to, prevFrom, prevTo } = periodBounds(days);
  const { connectionId } = req.query;

  try {
    const storeConnections = resolveStoreConnections(connectionId);
    const allOrders = storeConnections.length ? await getOrdersForConnections(storeConnections) : [];
    const currency = allOrders[0]?.currency || "RSD";

    const curr = periodRevenueOrders(allOrders, from, to);
    const prev = periodRevenueOrders(allOrders, prevFrom, prevTo);

    const metaConnections = linkedMetaConnections(storeConnections);
    let spendCurr = 0;
    let spendPrev = 0;
    // Pixel-tracked purchase value attributed to the ads themselves
    // (per-ad "revenue" from Meta's insights, in the store's own
    // currency) — not the store's total revenue, which also includes
    // organic/direct/other-channel sales the ads had nothing to do with.
    // Dividing total store revenue by ad spend is a much bigger number
    // than ROAS and not what that word means.
    let adRevenueCurr = 0;
    let adRevenuePrev = 0;
    let metaCurrency = null;
    await Promise.all(
      metaConnections.map(async (m) => {
        try {
          const [pc, pp] = await Promise.all([
            meta.getPerformance(m, { from, to }),
            meta.getPerformance(m, { from: prevFrom, to: prevTo }),
          ]);
          spendCurr += pc.totals.spend;
          spendPrev += pp.totals.spend;
          adRevenueCurr += pc.allAds.reduce((s, ad) => s + (ad.revenue || 0), 0);
          adRevenuePrev += pp.allAds.reduce((s, ad) => s + (ad.revenue || 0), 0);
          if (!metaCurrency) metaCurrency = pc.currency;
        } catch {
          // this Meta connection's fetch failed — skip it, don't fail the summary
        }
      })
    );

    const [crCurr, crPrev] = storeConnections.length
      ? await Promise.all([
          computeConversionRate(storeConnections, { from, to }),
          computeConversionRate(storeConnections, { from: prevFrom, to: prevTo }),
        ])
      : [null, null];

    // Meta reports spend in the ad account's billing currency, which is
    // often not the store's own currency (EUR ad spend vs RSD ad revenue,
    // here) — dividing one by the other without converting isn't a
    // rounding quirk, it's a meaningless number. Convert the ad-attributed
    // revenue into Meta's currency first so both sides of the ratio
    // actually match; only skip the calc if that conversion itself isn't
    // supported (some currency pair this app has never seen).
    let roasCurr = null;
    let roasPrev = null;
    if (metaCurrency && spendCurr > 0) {
      const adRevenueCurrConverted = await fx.convert(adRevenueCurr, currency, metaCurrency);
      if (adRevenueCurrConverted != null) roasCurr = adRevenueCurrConverted / spendCurr;
    }
    if (metaCurrency && spendPrev > 0) {
      const adRevenuePrevConverted = await fx.convert(adRevenuePrev, currency, metaCurrency);
      if (adRevenuePrevConverted != null) roasPrev = adRevenuePrevConverted / spendPrev;
    }

    res.json({
      currency,
      metaCurrency,
      period: { from, to, days },
      revenue: { current: curr.revenue, previous: prev.revenue, changePercent: changePercent(curr.revenue, prev.revenue) },
      orders: { current: curr.orders, previous: prev.orders, changePercent: changePercent(curr.orders, prev.orders) },
      aov: { current: curr.aov, previous: prev.aov, changePercent: changePercent(curr.aov, prev.aov) },
      adSpend: { current: spendCurr, previous: spendPrev, changePercent: changePercent(spendCurr, spendPrev) },
      roas: { current: roasCurr, previous: roasPrev, changePercent: changePercent(roasCurr, roasPrev) },
      conversionRate: { current: crCurr, previous: crPrev, changePercent: changePercent(crCurr, crPrev) },
    });
  } catch (err) {
    res.status(400).json({ error: "Ne mogu da izračunam pregled." });
  }
});

router.get("/dashboard/anomalies", async (req, res) => {
  const days = Number(req.query.days) || DEFAULT_DAYS;
  const { from, to, prevFrom, prevTo } = periodBounds(days);
  const { connectionId } = req.query;

  try {
    const anomalies = await detectAnomalies({ from, to, prevFrom, prevTo, connectionId });
    res.json({ anomalies });
  } catch (err) {
    res.status(400).json({ error: "Ne mogu da izračunam anomalije." });
  }
});

module.exports = router;
