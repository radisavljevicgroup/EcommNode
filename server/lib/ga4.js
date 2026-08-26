const { parseServiceAccount, getAccessToken } = require("./googleServiceAuth");

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

async function testConnection(connection) {
  const serviceAccount = parseServiceAccount(connection.serviceAccountJson);
  const token = await getAccessToken(serviceAccount, GA4_SCOPE);

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

  return serviceAccount.client_email;
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

async function runReport(connection, token, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${connection.propertyId}:runReport`,
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
    const err = new Error(data?.error?.message || `GA4 API greška (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function aggregateTrend(dateRows, unit) {
  const sorted = [...dateRows].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (unit === "day") {
    return sorted.map((r) => ({ date: r.date, sessions: r.sessions, activeUsers: r.activeUsers }));
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

async function getPerformance(connection, { from, to } = {}) {
  const serviceAccount = parseServiceAccount(connection.serviceAccountJson);
  const token = await getAccessToken(serviceAccount, GA4_SCOPE);

  const latestAvailable = new Date();
  latestAvailable.setDate(latestAvailable.getDate() - REPORTING_LAG_DAYS);

  let endDate = to ? new Date(to) : latestAvailable;
  if (endDate > latestAvailable) endDate = latestAvailable;

  let startDate = from ? new Date(from) : new Date(endDate);
  if (!from) startDate.setDate(startDate.getDate() - DEFAULT_DAYS);
  if (startDate > endDate) startDate = new Date(endDate);

  const dateRange = { startDate: isoDate(startDate), endDate: isoDate(endDate) };
  const spanDays = Math.max((endDate - startDate) / DAY_MS, 1);
  const unit = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";

  const trendMetrics = [
    { name: "sessions" },
    { name: "activeUsers" },
    { name: "conversions" },
    { name: "engagementRate" },
  ];

  const [dateReport, pageReport, channelReport] = await Promise.all([
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
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
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

  const totals = {
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
  }));

  return { dateRange, totals, trend, topPages, topChannels };
}

module.exports = { testConnection, getPerformance };
