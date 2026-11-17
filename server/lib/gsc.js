const { parseServiceAccount, getAccessToken } = require("./googleServiceAuth");
const { getAccessTokenFromRefreshToken } = require("./googleOAuthClient");
const { trackRefresh } = require("./refreshTracker");

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// Connections made via "Poveži se sa Google nalogom" carry a refreshToken;
// older ones made via the retired manual service-account-JSON form carry
// serviceAccountJson instead — both still work for reading data, only how
// a NEW connection is created has changed (routes/gsc.js's /gsc/connect).
async function getToken(connection) {
  if (connection.refreshToken) {
    return getAccessTokenFromRefreshToken(connection.refreshToken);
  }
  const serviceAccount = parseServiceAccount(connection.serviceAccountJson);
  return getAccessToken(serviceAccount, GSC_SCOPE);
}

// Every Search Console property the Google account can access, for
// GscConnectModal.jsx's picker — mirrors listProperties in lib/ga4.js.
// Sites the account can see but was never actually verified on
// (siteUnverifiedUser) are filtered out since Search Console API calls
// against those just 404.
async function listSites(accessToken) {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Search Console API greška (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return (data.siteEntry || [])
    .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel || null }));
}

async function testConnection(connection) {
  const token = await getToken(connection);

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(connection.siteUrl)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(
      data?.error?.message || `Search Console API greška (HTTP ${res.status}).`
    );
    err.status = res.status;
    throw err;
  }

  return true;
}

const DEFAULT_DAYS = 28;
// Search Console data has a reporting lag of a couple of days — asking for
// "today" just returns zeroed-out rows for the most recent days.
const REPORTING_LAG_DAYS = 3;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function queryAnalytics(connection, token, body) {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      connection.siteUrl
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(
      data?.error?.message || `Search Console API greška (HTTP ${res.status}).`
    );
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.rows || [];
}

function weekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function aggregateTrend(dateRows, unit) {
  const sorted = [...dateRows].sort((a, b) => (a.keys[0] < b.keys[0] ? -1 : 1));
  if (unit === "day") {
    return sorted.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions }));
  }
  const buckets = new Map();
  sorted.forEach((r) => {
    const key = unit === "week" ? weekStart(r.keys[0]) : r.keys[0].slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, { date: key, clicks: 0, impressions: 0 });
    const b = buckets.get(key);
    b.clicks += r.clicks;
    b.impressions += r.impressions;
  });
  return [...buckets.values()];
}

// Every Analitika/SEO load used to ask Search Console again (3 queries).
// Its data lags ~3 days and changes slowly, so a range is kept for
// CACHE_TTL_MS; after that the old copy is still served while a background
// refetch replaces it (marked X-Data-Refreshing, see lib/refreshTracker.js).
const CACHE_TTL_MS = 60 * 60 * 1000;
const performanceCache = new Map(); // key -> { data, at }
const inflight = new Map();

function fetchOnce(key, connection, range) {
  if (!inflight.has(key)) {
    inflight.set(
      key,
      fetchPerformance(connection, range)
        .then((data) => {
          performanceCache.set(key, { data, at: Date.now() });
          return data;
        })
        .finally(() => inflight.delete(key))
    );
  }
  return inflight.get(key);
}

function getPerformance(connection, { from, to } = {}) {
  const { dateRange } = resolveDates({ from, to });
  const key = `${connection.id}::${connection.siteUrl}::${dateRange.startDate}::${dateRange.endDate}`;
  const cached = performanceCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.data);
  if (cached) {
    trackRefresh(fetchOnce(key, connection, { from, to }).catch(() => {}));
    return Promise.resolve(cached.data);
  }
  return fetchOnce(key, connection, { from, to });
}

function resolveDates({ from, to } = {}) {
  const latestAvailable = new Date();
  latestAvailable.setDate(latestAvailable.getDate() - REPORTING_LAG_DAYS);

  let endDate = to ? new Date(to) : latestAvailable;
  if (endDate > latestAvailable) endDate = latestAvailable;

  let startDate = from ? new Date(from) : new Date(endDate);
  if (!from) startDate.setDate(startDate.getDate() - DEFAULT_DAYS);
  if (startDate > endDate) startDate = new Date(endDate);

  const dateRange = { startDate: isoDate(startDate), endDate: isoDate(endDate) };
  return { startDate, endDate, dateRange };
}

async function fetchPerformance(connection, { from, to } = {}) {
  const token = await getToken(connection);
  const { startDate, endDate, dateRange } = resolveDates({ from, to });
  const spanDays = Math.max((endDate - startDate) / (1000 * 60 * 60 * 24), 1);
  const unit = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";

  const [dateRows, queryRows, pageRows] = await Promise.all([
    queryAnalytics(connection, token, { ...dateRange, dimensions: ["date"], rowLimit: 1000 }),
    queryAnalytics(connection, token, { ...dateRange, dimensions: ["query"], rowLimit: 10 }),
    queryAnalytics(connection, token, { ...dateRange, dimensions: ["page"], rowLimit: 10 }),
  ]);

  const trend = aggregateTrend(dateRows, unit);

  const totalClicks = trend.reduce((sum, r) => sum + r.clicks, 0);
  const totalImpressions = trend.reduce((sum, r) => sum + r.impressions, 0);
  const weightedPositionSum = dateRows.reduce((sum, r) => sum + r.position * r.impressions, 0);

  const totals = {
    clicks: totalClicks,
    impressions: totalImpressions,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    position: totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0,
  };

  const toRow = (keyName) => (r) => ({
    [keyName]: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr * 100,
    position: r.position,
  });

  return {
    dateRange,
    totals,
    trend,
    topQueries: queryRows.map(toRow("query")),
    topPages: pageRows.map(toRow("page")),
  };
}

module.exports = { testConnection, getPerformance, listSites };
