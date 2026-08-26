const { parseServiceAccount, getAccessToken } = require("./googleServiceAuth");

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

async function testConnection(connection) {
  const serviceAccount = parseServiceAccount(connection.serviceAccountJson);
  const token = await getAccessToken(serviceAccount, GSC_SCOPE);

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

  return serviceAccount.client_email;
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

async function getPerformance(connection, { from, to } = {}) {
  const serviceAccount = parseServiceAccount(connection.serviceAccountJson);
  const token = await getAccessToken(serviceAccount, GSC_SCOPE);

  const latestAvailable = new Date();
  latestAvailable.setDate(latestAvailable.getDate() - REPORTING_LAG_DAYS);

  let endDate = to ? new Date(to) : latestAvailable;
  if (endDate > latestAvailable) endDate = latestAvailable;

  let startDate = from ? new Date(from) : new Date(endDate);
  if (!from) startDate.setDate(startDate.getDate() - DEFAULT_DAYS);
  if (startDate > endDate) startDate = new Date(endDate);

  const dateRange = { startDate: isoDate(startDate), endDate: isoDate(endDate) };
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

module.exports = { testConnection, getPerformance };
