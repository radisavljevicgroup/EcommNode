const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const DEFAULT_DAYS = 28;
const DAY_MS = 1000 * 60 * 60 * 24;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function toNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Meta's "purchase" action can show up under a couple of different
// action_type values depending on how the pixel/CAPI event was sent —
// checking both is the difference between a real number here and a
// silent 0 for stores that use the offsite-conversion variant.
function extractPurchases(actions) {
  if (!Array.isArray(actions)) return 0;
  const match = actions.find(
    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return match ? toNumber(match.value) : 0;
}

// action_values has the same {action_type, value} shape as actions, but
// value is the monetary total for that action type instead of a count —
// this is how purchase revenue (not just purchase count) is recovered.
function extractPurchaseRevenue(actionValues) {
  if (!Array.isArray(actionValues)) return 0;
  const match = actionValues.find(
    (a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase"
  );
  return match ? toNumber(match.value) : 0;
}

// Meta's follow action_type varies by placement/objective (page follow vs
// Instagram profile follow) — no single canonical key, so match loosely.
function extractFollows(actions) {
  if (!Array.isArray(actions)) return 0;
  const match = actions.find((a) => a.action_type && a.action_type.toLowerCase().includes("follow"));
  return match ? toNumber(match.value) : 0;
}

// Error code 190 is Meta's "invalid/expired OAuth token" — everything else
// (missing ads_read permission, bad ad account id, etc.) surfaces as a
// generic 400 from the Graph API, so 190 is the one worth distinguishing.
async function graphFetch(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || `Meta API greška (HTTP ${res.status}).`);
    err.status = data.error?.code === 190 ? 401 : res.status;
    throw err;
  }
  return data;
}

async function graphRequest(path, params, accessToken) {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("access_token", accessToken);
  return graphFetch(url.toString());
}

async function testConnection({ accessToken, adAccountId }) {
  const data = await graphRequest(
    `/act_${adAccountId}`,
    { fields: "name,account_status,currency" },
    accessToken
  );
  return { name: data.name || null, currency: data.currency || null };
}

async function fetchInsights(adAccountId, accessToken, params) {
  const url = new URL(`${GRAPH_API_BASE}/act_${adAccountId}/insights`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("access_token", accessToken);
  if (!params.limit) url.searchParams.set("limit", "500");

  // Meta paginates insights results (default page size ~25) — with
  // time_increment=1 over a multi-month range that's many pages. Following
  // paging.next is required or totals/trend silently truncate to the
  // first page instead of covering the full requested range.
  let rows = [];
  let nextUrl = url.toString();
  while (nextUrl) {
    const data = await graphFetch(nextUrl);
    rows = rows.concat(data.data || []);
    nextUrl = data.paging?.next || null;
  }
  return rows;
}

// Budget, schedule, status, and creative format live on the ad/adset
// objects, not on /insights — a separate lookup. Scoped to just the ad IDs
// that actually had activity in the requested period, via an ID filter on
// the /ads edge (the bare "/?ids=" multi-get is deprecated on current API
// versions) rather than paginating the account's entire ad history, which
// for an account running since 2025 could be hundreds of old ads and made
// this page take unreasonably long to load.
async function fetchAdMetaByIds(adAccountId, adIds, accessToken) {
  if (!adIds.length) return new Map();
  const fields = "id,effective_status,adset{daily_budget,lifetime_budget,start_time,end_time},creative{object_type}";

  const chunks = [];
  for (let i = 0; i < adIds.length; i += 50) chunks.push(adIds.slice(i, i + 50));

  const results = await Promise.all(
    chunks.map((chunk) => {
      const url = new URL(`${GRAPH_API_BASE}/act_${adAccountId}/ads`);
      url.searchParams.set("fields", fields);
      url.searchParams.set("filtering", JSON.stringify([{ field: "id", operator: "IN", value: chunk }]));
      url.searchParams.set("limit", "50");
      url.searchParams.set("access_token", accessToken);
      return graphFetch(url.toString());
    })
  );

  const map = new Map();
  results.forEach((data) => {
    (data.data || []).forEach((row) => map.set(row.id, row));
  });
  return map;
}

// Same reasoning as ga4.js's cache — this is called on every "Analiza
// prodaje" / dashboard load and involves several real Graph API round
// trips per connection, so a short cache absorbs repeated loads of the
// same range.
const performanceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getPerformance(connection, { from, to } = {}) {
  const cacheKey = `${connection.id}::${from || ""}::${to || ""}`;
  const cached = performanceCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const { accessToken, adAccountId } = connection;

  const endDate = to ? new Date(to) : new Date();
  const startDate = from ? new Date(from) : new Date(endDate.getTime() - DEFAULT_DAYS * DAY_MS);
  const timeRange = JSON.stringify({ since: isoDate(startDate), until: isoDate(endDate) });

  const [dailyRows, campaignRows, adRows] = await Promise.all([
    fetchInsights(adAccountId, accessToken, {
      time_range: timeRange,
      time_increment: 1,
      fields: "spend,impressions,clicks,actions",
      level: "account",
    }),
    fetchInsights(adAccountId, accessToken, {
      time_range: timeRange,
      fields: "campaign_name,spend,impressions,clicks,actions",
      level: "campaign",
      limit: 50,
    }),
    fetchInsights(adAccountId, accessToken, {
      time_range: timeRange,
      fields: "ad_id,ad_name,campaign_name,spend,impressions,clicks,reach,actions,action_values",
      level: "ad",
    }),
  ]);

  const adIds = [...new Set(adRows.map((r) => r.ad_id).filter(Boolean))];
  const adMetaById = await fetchAdMetaByIds(adAccountId, adIds, accessToken);

  const trend = dailyRows
    .map((r) => ({
      date: r.date_start,
      spend: toNumber(r.spend),
      impressions: toNumber(r.impressions),
      clicks: toNumber(r.clicks),
      purchases: extractPurchases(r.actions),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const totalSpend = trend.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = trend.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = trend.reduce((s, r) => s + r.clicks, 0);
  const totalPurchases = trend.reduce((s, r) => s + r.purchases, 0);

  const totals = {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    purchases: totalPurchases,
    cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
  };

  const topCampaigns = campaignRows
    .map((r) => ({
      campaign: r.campaign_name,
      spend: toNumber(r.spend),
      impressions: toNumber(r.impressions),
      clicks: toNumber(r.clicks),
      purchases: extractPurchases(r.actions),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  const allAds = adRows
    .map((r) => {
      const spend = toNumber(r.spend);
      const impressions = toNumber(r.impressions);
      const clicks = toNumber(r.clicks);
      const reach = toNumber(r.reach);
      const follows = extractFollows(r.actions);
      const purchases = extractPurchases(r.actions);
      // Meta reports purchase VALUE in whatever currency the pixel/CAPI
      // event fired with (the store's own currency), not the ad account's
      // billing currency — profit (which needs both in the same unit) is
      // computed by the caller, which knows the store's actual currency.
      const revenue = extractPurchaseRevenue(r.action_values);

      const meta = adMetaById.get(r.ad_id) || {};
      const adset = meta.adset || {};
      const start = adset.start_time || null;
      const end = adset.end_time || null;
      // Still-running ads have no end_time — count elapsed days up to now.
      const days = start
        ? Math.max(1, Math.ceil((new Date(end || Date.now()) - new Date(start)) / DAY_MS))
        : null;
      // Meta returns budgets in the account's minor currency unit (cents).
      // Campaigns using a lifetime (not daily) budget have no daily_budget
      // at all — approximate a daily figure by spreading it over the run.
      const dailyBudget =
        adset.daily_budget != null
          ? toNumber(adset.daily_budget) / 100
          : adset.lifetime_budget != null && days
            ? toNumber(adset.lifetime_budget) / 100 / days
            : null;

      return {
        adName: r.ad_name,
        campaign: r.campaign_name,
        status: meta.effective_status === "ACTIVE" ? "active" : "inactive",
        start,
        pricePerDay: dailyBudget,
        days,
        total: spend,
        adType: meta.creative?.object_type || null,
        reach,
        impressions,
        clicks,
        follows,
        purchases,
        revenue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        // null (not 0) when there were no follows/purchases — 0 would read
        // as "free acquisition" instead of "not applicable here".
        cpf: follows > 0 ? spend / follows : null,
        cpa: purchases > 0 ? spend / purchases : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  const result = {
    dateRange: { startDate: isoDate(startDate), endDate: isoDate(endDate) },
    currency: connection.currency || null,
    totals,
    trend,
    topCampaigns,
    allAds,
  };
  performanceCache.set(cacheKey, { data: result, at: Date.now() });
  return result;
}

module.exports = { testConnection, getPerformance };
