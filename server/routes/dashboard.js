const { Router } = require("express");
const { getConnections: getWooConnections } = require("../lib/store");
const { getConnections: getShopifyConnections } = require("../lib/shopifyStore");
const { getConnections: getMetaConnections } = require("../lib/metaStore");
const { getOrdersForConnections } = require("../lib/ordersCache");
const { computeConversionRate } = require("../lib/conversionRate");
const { detectAnomalies } = require("../lib/anomalies");
const meta = require("../lib/meta");
const fx = require("../lib/currency");
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

// Same "current vs. immediately preceding period of equal length"
// comparison as periodBounds above, but anchored to an explicit [from, to]
// (e.g. a DateRangePicker preset like "Ovaj mesec"/"Prošli mesec") instead
// of a rolling N-days-from-now window — periodBounds can't express "prošli
// mesec" since it always ends at "now".
function periodBoundsFromRange(fromStr, toStr) {
  const from = new Date(fromStr);
  const to = new Date(analytics.endOfDayIfDateOnly(toStr));
  const spanMs = to.getTime() - from.getTime() + 1;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs + 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    prevFrom: prevFrom.toISOString(),
    prevTo: prevTo.toISOString(),
  };
}

function resolvePeriod(query) {
  if (query.from && query.to) return periodBoundsFromRange(query.from, query.to);
  return periodBounds(Number(query.days) || DEFAULT_DAYS);
}

function changePercent(current, previous) {
  if (current === null || current === undefined) return null;
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function periodRevenueOrders(allOrders, from, to) {
  const periodOrders = analytics.realized(analytics.filterByRange(allOrders, from, to));
  const revenue = periodOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  return {
    revenue,
    orders: periodOrders.length,
    aov: periodOrders.length ? revenue / periodOrders.length : 0,
    statusCounts: analytics.orderStatusCounts(allOrders, from, to),
  };
}

// Only Meta connections actually targeting one of the brand-filtered
// stores contribute — a brand's dashboard must never blend in another
// brand's ad spend just because both happen to be connected.
function linkedMetaConnections(storeConnections, company) {
  return getMetaConnections(company).filter((m) =>
    (m.targetConnectionIds || []).some((id) => storeConnections.some((c) => c.id === id))
  );
}

// connectionIds (comma list) is the newer multi-brand filter used by the
// manager home page's MultiSelect; connectionId (single) stays for the
// original single-brand dropdown on the generic Dashboard.
function resolveStoreConnections(query, company) {
  const all = [...getWooConnections(company), ...getShopifyConnections(company)];
  if (query.connectionIds) {
    const ids = query.connectionIds.split(",").filter(Boolean);
    return all.filter((c) => ids.includes(c.id));
  }
  return query.connectionId ? all.filter((c) => c.id === query.connectionId) : all;
}

// parts=core  → orders/revenue/logistics only (from the local orders cache,
//               answers at once);
// parts=ads   → Meta spend/ROAS/MER + conversion rate (Meta and GA4, can
//               take a while on long ranges);
// (omitted)   → both, as before.
// The home pages ask for core and ads separately so the order cards don't
// wait for Meta/GA4; ad fields in a core-only answer are null.
const EMPTY_CHANGE = { current: null, previous: null, changePercent: null };

router.get("/dashboard/summary", async (req, res) => {
  const { from, to, prevFrom, prevTo } = resolvePeriod(req.query);
  const parts = req.query.parts || "all";
  const wantAds = parts !== "core";

  try {
    const storeConnections = resolveStoreConnections(req.query, req.company);
    const allOrders = storeConnections.length ? await getOrdersForConnections(storeConnections) : [];
    const currency = allOrders[0]?.currency || "RSD";

    const curr = periodRevenueOrders(allOrders, from, to);
    const prev = periodRevenueOrders(allOrders, prevFrom, prevTo);

    const metaConnections = linkedMetaConnections(storeConnections, req.company);
    const selectedIds = new Set(storeConnections.map((c) => c.id));
    const allStores = [...getWooConnections(req.company), ...getShopifyConnections(req.company)];
    let metaCurrency = null;

    // One Meta ad account often advertises several stores (papagaj.rs,
    // parkerolovke.rs...) — a dashboard filtered to one store must count
    // only that store's ads, not the whole account. Each ad is assigned to
    // a store by its website link (meta.adStoreId). Ads that can't be
    // assigned (no website link: profile visits, messages...) count only
    // when every store the Meta connection targets is selected — then it's
    // the whole account anyway; otherwise they're reported as unattributed.
    //
    // revenue = pixel-tracked purchase value of those ads, already in the
    // ad account's currency ad by ad (withRevenueCurrency in lib/meta.js) —
    // not the store's total revenue (that's MER, below).
    function metaTotals(perf, connection) {
      const coversAll = (connection.targetConnectionIds || []).every((id) => selectedIds.has(id));
      const t = { spend: 0, revenue: 0, unattributedSpend: 0 };
      for (const ad of perf.allAds || []) {
        const storeId = meta.adStoreId(ad, connection, allStores);
        const counts = storeId ? selectedIds.has(storeId) : coversAll;
        if (counts) {
          t.spend += ad.total || 0;
          t.revenue += ad.revenueInAccount || 0;
        } else if (!storeId) {
          t.unattributedSpend += ad.total || 0;
        }
      }
      return t;
    }

    const metaCurr = { spend: 0, revenue: 0, unattributedSpend: 0 };
    const metaPrev = { spend: 0, revenue: 0, unattributedSpend: 0 };
    await Promise.all(
      (wantAds ? metaConnections : []).map(async (m) => {
        try {
          // Light call: only ads that spent, with value and website link —
          // the full getPerformance (Meta Ads page) took ~80s on a year range.
          const [pc, pp] = await Promise.all([
            meta.getAdSummary(m, { from, to }),
            meta.getAdSummary(m, { from: prevFrom, to: prevTo }),
          ]);
          for (const [acc, t] of [
            [metaCurr, metaTotals(pc, m)],
            [metaPrev, metaTotals(pp, m)],
          ]) {
            acc.spend += t.spend;
            acc.revenue += t.revenue;
            acc.unattributedSpend += t.unattributedSpend;
          }
          if (!metaCurrency) metaCurrency = pc.currency;
        } catch {
          // this Meta connection's fetch failed — skip it, don't fail the summary
        }
      })
    );
    const spendCurr = metaCurr.spend;
    const spendPrev = metaPrev.spend;

    const [crCurr, crPrev] = wantAds && storeConnections.length
      ? await Promise.all([
          computeConversionRate(storeConnections, { from, to }),
          computeConversionRate(storeConnections, { from: prevFrom, to: prevTo }),
        ])
      : [null, null];

    // Meta reports spend in the ad account's billing currency, which is
    // often not the store's own currency (EUR ad spend vs RSD revenue) —
    // both ratios below are computed in Meta's currency.
    // ROAS: ad-attributed revenue (already in Meta's currency) / spend.
    const roasCurr = metaCurrency && spendCurr > 0 ? metaCurr.revenue / spendCurr : null;
    const roasPrev = metaCurrency && spendPrev > 0 ? metaPrev.revenue / spendPrev : null;
    // MER (Marketing Efficiency Ratio): the selected stores' total revenue
    // (all channels) / the spend on those same stores' ads.
    const storeCurrency = String(currency || "RSD").toUpperCase();
    async function mer(revenue, spend) {
      if (!metaCurrency || !(spend > 0)) return null;
      const converted = await fx.convert(revenue, storeCurrency, metaCurrency).catch(() => null);
      return converted == null ? null : converted / spend;
    }
    const [merCurr, merPrev] = await Promise.all([
      mer(curr.revenue, spendCurr),
      mer(prev.revenue, spendPrev),
    ]);

    if (!wantAds) {
      // Same shape as a full answer, so pages can render it as-is.
      return res.json({
        parts: "core",
        currency,
        metaCurrency: null,
        period: { from, to },
        revenue: { current: curr.revenue, previous: prev.revenue, changePercent: changePercent(curr.revenue, prev.revenue) },
        orders: { current: curr.orders, previous: prev.orders, changePercent: changePercent(curr.orders, prev.orders) },
        aov: { current: curr.aov, previous: prev.aov, changePercent: changePercent(curr.aov, prev.aov) },
        cancelledOrders: {
          current: curr.statusCounts.cancelled,
          previous: prev.statusCounts.cancelled,
          changePercent: changePercent(curr.statusCounts.cancelled, prev.statusCounts.cancelled),
        },
        shippedOrders: {
          current: curr.statusCounts.shipped,
          previous: prev.statusCounts.shipped,
          changePercent: changePercent(curr.statusCounts.shipped, prev.statusCounts.shipped),
        },
        deliveredOrders: {
          current: curr.statusCounts.delivered,
          previous: prev.statusCounts.delivered,
          changePercent: changePercent(curr.statusCounts.delivered, prev.statusCounts.delivered),
        },
        returnedOrders: {
          current: curr.statusCounts.returned,
          previous: prev.statusCounts.returned,
          changePercent: changePercent(curr.statusCounts.returned, prev.statusCounts.returned),
        },
        adSpend: EMPTY_CHANGE,
        roas: EMPTY_CHANGE,
        mer: EMPTY_CHANGE,
        adSpendUnattributed: null,
        conversionRate: EMPTY_CHANGE,
      });
    }

    res.json({
      parts,
      currency,
      metaCurrency,
      period: { from, to },
      revenue: { current: curr.revenue, previous: prev.revenue, changePercent: changePercent(curr.revenue, prev.revenue) },
      orders: { current: curr.orders, previous: prev.orders, changePercent: changePercent(curr.orders, prev.orders) },
      aov: { current: curr.aov, previous: prev.aov, changePercent: changePercent(curr.aov, prev.aov) },
      cancelledOrders: {
        current: curr.statusCounts.cancelled,
        previous: prev.statusCounts.cancelled,
        changePercent: changePercent(curr.statusCounts.cancelled, prev.statusCounts.cancelled),
      },
      shippedOrders: {
        current: curr.statusCounts.shipped,
        previous: prev.statusCounts.shipped,
        changePercent: changePercent(curr.statusCounts.shipped, prev.statusCounts.shipped),
      },
      deliveredOrders: {
        current: curr.statusCounts.delivered,
        previous: prev.statusCounts.delivered,
        changePercent: changePercent(curr.statusCounts.delivered, prev.statusCounts.delivered),
      },
      returnedOrders: {
        current: curr.statusCounts.returned,
        previous: prev.statusCounts.returned,
        changePercent: changePercent(curr.statusCounts.returned, prev.statusCounts.returned),
      },
      adSpend: { current: spendCurr, previous: spendPrev, changePercent: changePercent(spendCurr, spendPrev) },
      roas: { current: roasCurr, previous: roasPrev, changePercent: changePercent(roasCurr, roasPrev) },
      mer: { current: merCurr, previous: merPrev, changePercent: changePercent(merCurr, merPrev) },
      // Meta spend on ads that couldn't be tied to a selected store (no
      // website link) and so was left out of adSpend/ROAS/MER.
      adSpendUnattributed: metaCurr.unattributedSpend,
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
    const anomalies = await detectAnomalies({ from, to, prevFrom, prevTo, connectionId, company: req.company });
    res.json({ anomalies });
  } catch (err) {
    res.status(400).json({ error: "Ne mogu da izračunam anomalije." });
  }
});

module.exports = router;
