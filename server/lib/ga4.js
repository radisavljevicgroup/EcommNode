const { parseServiceAccount, getAccessToken } = require("./googleServiceAuth");
const { getAccessTokenFromRefreshToken } = require("./googleOAuthClient");
const { runLimited } = require("./ga4Limiter");

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

// Connections made via "Poveži se sa Google nalogom" carry a refreshToken;
// older ones made via the retired manual service-account-JSON form carry
// serviceAccountJson instead — both still work for reading data, only how
// a NEW connection is created has changed (routes/ga4.js's /ga4/connect).
async function getToken(connection) {
  if (connection.refreshToken) {
    return getAccessTokenFromRefreshToken(connection.refreshToken);
  }
  const serviceAccount = parseServiceAccount(connection.serviceAccountJson);
  return getAccessToken(serviceAccount, GA4_SCOPE);
}

// Every GA4 account (there can be several) and every property under each,
// flattened into one pickable list for Ga4ConnectModal.jsx — mirrors
// listAdAccounts in lib/meta.js. The analytics.readonly scope covers this
// Admin API read the same way it covers the Data API report calls below.
async function listProperties(accessToken) {
  const url = new URL("https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
  url.searchParams.set("pageSize", "200");

  const items = [];
  let pageToken;
  do {
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error?.message || `GA4 Admin API greška (HTTP ${res.status}).`);
      err.status = res.status;
      throw err;
    }
    (data.accountSummaries || []).forEach((account) => {
      (account.propertySummaries || []).forEach((property) => {
        items.push({
          propertyId: (property.property || "").replace("properties/", ""),
          displayName: property.displayName || null,
          accountName: account.displayName || null,
        });
      });
    });
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return items;
}

async function testConnection(connection) {
  const token = await getToken(connection);

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${connection.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "yesterday", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
        limit: 1,
      }),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error?.message || `GA4 API greška (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }

  return true;
}

const DEFAULT_DAYS = 28;
// GA4 processing can lag by a few hours — "today" is usually incomplete.
const REPORTING_LAG_DAYS = 1;
const DAY_MS = 1000 * 60 * 60 * 24;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// GA4's "date" dimension comes back as "YYYYMMDD" with no separators.
function ga4DateToIso(d) {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function weekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function metricValue(row, index) {
  return Number(row.metricValues[index]?.value || 0);
}

function runReport(connection, token, body) {
  return runLimited(connection.propertyId, () => runReportOnce(connection, token, body));
}

// Some properties occasionally take 50-60s per report on Google's side, then
// answer 502 anyway (seen 2026-11-13 on the Casio property for a year-long
// range, while the same reports for other properties took under a second).
// Without a limit one such property held its 4 limiter slots for minutes and
// every page that waits for GA4 (home cards, Analitika) waited with it. A
// report that hasn't answered in 20s is given up on; callers already treat a
// failed GA4 fetch as "skip this store".
const REPORT_TIMEOUT_MS = 20 * 1000;

async function runReportOnce(connection, token, body) {
  let res;
  try {
    res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${connection.propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
      }
    );
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      const e = new Error(`Google Analytics nije odgovorio za ${REPORT_TIMEOUT_MS / 1000}s — pokušaj ponovo malo kasnije.`);
      e.status = 504;
      throw e;
    }
    throw err;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error?.message || `GA4 API greška (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function aggregateTrend(dateRows, unit) {
  const sorted = [...dateRows].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (unit === "day") {
    return sorted.map((r) => ({
      date: r.date,
      sessions: r.sessions,
      activeUsers: r.activeUsers,
      conversions: r.conversions,
    }));
  }
  const buckets = new Map();
  sorted.forEach((r) => {
    const key = unit === "week" ? weekStart(r.date) : r.date.slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, { date: key, sessions: 0, activeUsers: 0 });
    const b = buckets.get(key);
    b.sessions += r.sessions;
    b.activeUsers += r.activeUsers;
  });
  return [...buckets.values()];
}

// "Analiza prodaje" fires this on every page load and every filter change
// (brand/date range), and each call is 4 real HTTP round-trips to the GA4
// Data API — a short cache absorbs repeated loads of the same range instead
// of re-fetching identical numbers every time.
const performanceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
// A range that ended before today can't change any more (GA4 finishes
// processing within a day) — no reason to re-ask Google every 5 minutes.
const PAST_RANGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Keyed by the resolved calendar dates, not the raw from/to: callers pass
// full timestamps ("now" with milliseconds), which made every call a cache miss.
function rangeCacheKey(connection, range) {
  const { startDate, endDate } = resolveRange(range);
  return `${connection.id}::${isoDate(startDate)}::${isoDate(endDate)}`;
}

function cacheTtl(range) {
  const { endDate } = resolveRange(range);
  return isoDate(endDate) < isoDate(new Date(Date.now() - 2 * DAY_MS)) ? PAST_RANGE_CACHE_TTL_MS : CACHE_TTL_MS;
}

function cachedValue(cache, key, range) {
  const cached = cache.get(key);
  return cached && Date.now() - cached.at < cacheTtl(range) ? cached.data : null;
}

function resolveRange({ from, to } = {}) {
  const latestAvailable = new Date();
  latestAvailable.setDate(latestAvailable.getDate() - REPORTING_LAG_DAYS);

  let endDate = to ? new Date(to) : latestAvailable;
  if (endDate > latestAvailable) endDate = latestAvailable;

  let startDate = from ? new Date(from) : new Date(endDate);
  if (!from) startDate.setDate(startDate.getDate() - DEFAULT_DAYS);
  if (startDate > endDate) startDate = new Date(endDate);

  return { startDate, endDate };
}

// The cache above is only filled once a fetch finishes — several callers
// asking for the same connection+range at the same moment (dashboard,
// anomalies, alerts and the GA4 page all on one load) each started their own
// full set of reports. Concurrent identical calls now share one promise.
const inflight = new Map();
// A property that just failed (timeout, 502) is remembered for a minute, so
// the next page load answers "no GA4 for this store" at once instead of
// waiting another 20s for the same failure.
const FAILURE_TTL_MS = 60 * 1000;
const recentFailures = new Map(); // key -> { at, err }

function dedupe(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const failed = recentFailures.get(key);
  if (failed && Date.now() - failed.at < FAILURE_TTL_MS) return Promise.reject(failed.err);
  const p = fn()
    .then((v) => {
      recentFailures.delete(key);
      return v;
    })
    .catch((err) => {
      recentFailures.set(key, { at: Date.now(), err });
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function getPerformance(connection, { from, to } = {}) {
  const cacheKey = rangeCacheKey(connection, { from, to });
  const cached = cachedValue(performanceCache, cacheKey, { from, to });
  if (cached) return Promise.resolve(cached);
  return dedupe(`perf::${cacheKey}`, () => fetchPerformance(connection, { from, to }, cacheKey));
}

async function fetchPerformance(connection, { from, to }, cacheKey) {
  const token = await getToken(connection);

  const { startDate, endDate } = resolveRange({ from, to });

  const dateRange = { startDate: isoDate(startDate), endDate: isoDate(endDate) };
  const spanDays = Math.max((endDate - startDate) / DAY_MS, 1);
  const unit = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";

  const trendMetrics = [
    { name: "sessions" },
    { name: "activeUsers" },
    { name: "conversions" },
    { name: "engagementRate" },
  ];

  const [dateReport, pageReport, channelReport, totalsReport] = await Promise.all([
    runReport(connection, token, {
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: trendMetrics,
      limit: 1000,
    }),
    runReport(connection, token, {
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
    runReport(connection, token, {
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      // GA4 has ~15 default channel groups — a limit of 10 would silently
      // drop some, undercounting the total conversions total below it.
      limit: 20,
    }),
    // No dimensions = one row of period-wide totals. activeUsers is a
    // unique count, so summing the per-day rows (what totals used to do)
    // counts a returning user once per day they visited — over "Ova
    // godina" that inflated Aktivni korisnici several times over.
    runReport(connection, token, {
      dateRanges: [dateRange],
      metrics: trendMetrics,
    }),
  ]);

  const dateRows = (dateReport.rows || []).map((r) => ({
    date: ga4DateToIso(r.dimensionValues[0].value),
    sessions: metricValue(r, 0),
    activeUsers: metricValue(r, 1),
    conversions: metricValue(r, 2),
    engagementRate: metricValue(r, 3),
  }));

  const trend = aggregateTrend(dateRows, unit);

  const totalSessions = dateRows.reduce((s, r) => s + r.sessions, 0);
  const totalUsers = dateRows.reduce((s, r) => s + r.activeUsers, 0);
  const totalConversions = dateRows.reduce((s, r) => s + r.conversions, 0);
  const weightedEngagement = dateRows.reduce((s, r) => s + r.engagementRate * r.sessions, 0);

  const totalsRow = totalsReport.rows?.[0];
  const totals = totalsRow
    ? {
        sessions: metricValue(totalsRow, 0),
        activeUsers: metricValue(totalsRow, 1),
        conversions: metricValue(totalsRow, 2),
        engagementRate: metricValue(totalsRow, 3) * 100,
      }
    : {
        sessions: totalSessions,
        activeUsers: totalUsers,
        conversions: totalConversions,
        engagementRate: totalSessions > 0 ? (weightedEngagement / totalSessions) * 100 : 0,
      };

  const topPages = (pageReport.rows || []).map((r) => ({
    page: r.dimensionValues[0].value,
    views: metricValue(r, 0),
    sessions: metricValue(r, 1),
  }));

  const topChannels = (channelReport.rows || []).map((r) => ({
    channel: r.dimensionValues[0].value,
    sessions: metricValue(r, 0),
    activeUsers: metricValue(r, 1),
    conversions: metricValue(r, 2),
  }));

  const result = { dateRange, totals, trend, topPages, topChannels };
  performanceCache.set(cacheKey, { data: result, at: Date.now() });
  return result;
}

// ---- Insights: products (views vs. sales) and devices ----------------------
//
// Separate from getPerformance on purpose: both reports rely on GA4
// e-commerce events (view_item, add_to_cart, purchase with items[]), which
// not every property has set up — if they're missing, only these sections
// come back empty instead of the whole GA4 page failing.

// A product needs at least this many item views before its view→purchase
// rate is trusted; below it, one or two sales swing the rate wildly.
const MIN_VIEWS_FOR_RATE = 30;
// "Many views, weak sales": in the top quarter by views, converting at less
// than half the store's average rate.
const WEAK_RATE_FACTOR = 0.5;
// "Hidden winners": converting at 1.5× the store average or better, with at
// least 2 purchases, but in the bottom half by views — under-exposed.
const STRONG_RATE_FACTOR = 1.5;
const MIN_PURCHASES_FOR_WINNER = 2;
const PRODUCT_LIST_LIMIT = 15;

function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(q * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

function buildProductInsights(rows) {
  const products = rows
    .map((r) => ({
      name: r.dimensionValues[0].value,
      views: metricValue(r, 0),
      addedToCart: metricValue(r, 1),
      purchased: metricValue(r, 2),
      revenue: metricValue(r, 3),
    }))
    // GA4 reports items with no name as "(not set)" — nothing actionable.
    .filter((p) => p.name && p.name !== "(not set)");

  const totalViews = products.reduce((s, p) => s + p.views, 0);
  const totalPurchased = products.reduce((s, p) => s + p.purchased, 0);
  const avgRate = totalViews > 0 ? totalPurchased / totalViews : 0;

  const withRate = products.map((p) => ({
    ...p,
    viewToPurchaseRate: p.views > 0 ? (p.purchased / p.views) * 100 : null,
    viewToCartRate: p.views > 0 ? (p.addedToCart / p.views) * 100 : null,
  }));

  const rated = withRate.filter((p) => p.views >= MIN_VIEWS_FOR_RATE);
  const viewsAsc = rated.map((p) => p.views).sort((a, b) => a - b);
  const highViews = quantile(viewsAsc, 0.75);
  const medianViews = quantile(viewsAsc, 0.5);

  const weakSellers =
    avgRate > 0
      ? rated
          .filter((p) => p.views >= highViews && p.purchased / p.views < avgRate * WEAK_RATE_FACTOR)
          .sort((a, b) => b.views - a.views)
          .slice(0, PRODUCT_LIST_LIMIT)
      : [];

  const hiddenWinners =
    avgRate > 0
      ? rated
          .filter(
            (p) =>
              p.views <= medianViews &&
              p.purchased >= MIN_PURCHASES_FOR_WINNER &&
              p.purchased / p.views >= avgRate * STRONG_RATE_FACTOR
          )
          .sort((a, b) => b.viewToPurchaseRate - a.viewToPurchaseRate)
          .slice(0, PRODUCT_LIST_LIMIT)
      : [];

  return {
    averageViewToPurchaseRate: avgRate * 100,
    totalViews,
    totalPurchased,
    productCount: products.length,
    minViewsForRate: MIN_VIEWS_FOR_RATE,
    weakSellers,
    hiddenWinners,
    topViewed: withRate.slice(0, PRODUCT_LIST_LIMIT),
  };
}

const DEVICE_LABELS = { mobile: "Mobilni", desktop: "Desktop", tablet: "Tablet" };

function buildDeviceInsights(rows) {
  // Two dateRanges → GA4 appends a "dateRange" dimension (date_range_0 =
  // current, date_range_1 = previous) after the requested dimension.
  const byDevice = new Map();
  rows.forEach((r) => {
    const device = r.dimensionValues[0].value;
    const which = r.dimensionValues[1]?.value === "date_range_1" ? "previous" : "current";
    if (!byDevice.has(device)) byDevice.set(device, { current: null, previous: null });
    byDevice.get(device)[which] = {
      sessions: metricValue(r, 0),
      purchases: metricValue(r, 1),
      conversions: metricValue(r, 2),
      revenue: metricValue(r, 3),
    };
  });

  // Purchases (e-commerce purchase events) when the property tracks them,
  // otherwise GA4 key events — so the rate still means something on a
  // property without e-commerce tracking.
  const anyPurchases = [...byDevice.values()].some((d) => (d.current?.purchases || 0) > 0);
  const basis = anyPurchases ? "purchases" : "conversions";

  const rate = (p) => (p && p.sessions > 0 ? (p[basis] / p.sessions) * 100 : null);
  const totalSessions = [...byDevice.values()].reduce((s, d) => s + (d.current?.sessions || 0), 0);

  const devices = [...byDevice.entries()]
    .filter(([, d]) => d.current)
    .map(([device, d]) => {
      const conversionRate = rate(d.current);
      const previousConversionRate = rate(d.previous);
      return {
        device,
        label: DEVICE_LABELS[device] || device,
        sessions: d.current.sessions,
        sessionShare: totalSessions > 0 ? (d.current.sessions / totalSessions) * 100 : 0,
        orders: d.current[basis],
        revenue: d.current.revenue,
        conversionRate,
        previousConversionRate,
        changePercent:
          conversionRate != null && previousConversionRate
            ? ((conversionRate - previousConversionRate) / previousConversionRate) * 100
            : null,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  return { basis, devices };
}

const insightsCache = new Map();

function getInsights(connection, { from, to } = {}) {
  const cacheKey = rangeCacheKey(connection, { from, to });
  const cached = cachedValue(insightsCache, cacheKey, { from, to });
  if (cached) return Promise.resolve(cached);
  return dedupe(`insights::${cacheKey}`, () => fetchInsights(connection, { from, to }, cacheKey));
}

async function fetchInsights(connection, { from, to }, cacheKey) {
  const token = await getToken(connection);
  const { startDate, endDate } = resolveRange({ from, to });
  const dateRange = { startDate: isoDate(startDate), endDate: isoDate(endDate) };

  const spanMs = endDate - startDate + DAY_MS;
  const prevEnd = new Date(startDate.getTime() - DAY_MS);
  const prevStart = new Date(prevEnd.getTime() - spanMs + DAY_MS);
  const previousRange = { startDate: isoDate(prevStart), endDate: isoDate(prevEnd) };

  const [productReport, deviceReport] = await Promise.all([
    runReport(connection, token, {
      dateRanges: [dateRange],
      dimensions: [{ name: "itemName" }],
      metrics: [
        { name: "itemsViewed" },
        { name: "itemsAddedToCart" },
        { name: "itemsPurchased" },
        { name: "itemRevenue" },
      ],
      orderBys: [{ metric: { metricName: "itemsViewed" }, desc: true }],
      limit: 1000,
    }).catch((err) => ({ error: err.message })),
    runReport(connection, token, {
      dateRanges: [dateRange, previousRange],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [
        { name: "sessions" },
        { name: "ecommercePurchases" },
        { name: "conversions" },
        { name: "purchaseRevenue" },
      ],
    }).catch((err) => ({ error: err.message })),
  ]);

  const result = {
    dateRange,
    previousRange,
    products: productReport.error ? { error: productReport.error } : buildProductInsights(productReport.rows || []),
    devices: deviceReport.error ? { error: deviceReport.error } : buildDeviceInsights(deviceReport.rows || []),
  };
  insightsCache.set(cacheKey, { data: result, at: Date.now() });
  return result;
}

module.exports = { testConnection, getPerformance, getInsights, listProperties, weekStart };
