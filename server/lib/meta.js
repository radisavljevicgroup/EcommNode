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

// Every ad account the logged-in user can read, straight off their
// long-lived USER token — unlike Pages, Meta has no separate per-account
// token to mint, so the same token returned here is what gets stored and
// reused later for /act_<id>/insights calls (and is what
// metaAdsTokenRefresh.js keeps alive).
async function listAdAccounts(longLivedUserToken) {
  const url = new URL(`${GRAPH_API_BASE}/me/adaccounts`);
  url.searchParams.set("fields", "account_id,name,currency,account_status");
  url.searchParams.set("access_token", longLivedUserToken);
  const data = await graphFetch(url.toString());
  return (data.data || []).map((a) => ({
    id: a.account_id,
    name: a.name || null,
    currency: a.currency || null,
    // 1 = ACTIVE per Meta's Marketing API enum — surfaced so the picker can
    // flag a disabled/closed account instead of silently offering it.
    active: a.account_status === 1,
  }));
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

// /insights only returns rows for ads that actually delivered (had
// impressions) in the range — a freshly created ad that is still in
// review, scheduled for later, or simply hasn't served yet never shows up
// there, so the "Sve kampanje" table silently missed exactly the newest
// ads. This pulls the ads themselves (bounded by a status filter, not the
// whole account history) so they can be merged in with zero metrics.
const LISTED_STATUSES = [
  "ACTIVE",
  "PENDING_REVIEW",
  "IN_PROCESS",
  "PREAPPROVED",
  "WITH_ISSUES",
  "DISAPPROVED",
  "PENDING_BILLING_INFO",
  "PAUSED",
  "ADSET_PAUSED",
  "CAMPAIGN_PAUSED",
];
// Ads in these states are "current" regardless of when they were created;
// paused ones only count if they were created inside the requested range
// (otherwise every long-paused, never-delivered ad from 2025 would appear).
const ALWAYS_SHOWN_STATUSES = new Set(LISTED_STATUSES.filter((s) => !s.endsWith("PAUSED")));

async function fetchAccountAds(adAccountId, accessToken) {
  const url = new URL(`${GRAPH_API_BASE}/act_${adAccountId}/ads`);
  url.searchParams.set(
    "fields",
    "id,name,created_time,effective_status,campaign{name},adset{daily_budget,lifetime_budget,start_time,end_time},creative{object_type}"
  );
  url.searchParams.set(
    "filtering",
    JSON.stringify([{ field: "effective_status", operator: "IN", value: LISTED_STATUSES }])
  );
  url.searchParams.set("limit", "200");
  url.searchParams.set("access_token", accessToken);

  let rows = [];
  let nextUrl = url.toString();
  while (nextUrl) {
    const data = await graphFetch(nextUrl);
    rows = rows.concat(data.data || []);
    nextUrl = data.paging?.next || null;
  }
  return rows;
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

  const [dailyRows, campaignRows, insightAdRows, accountAds] = await Promise.all([
    fetchInsights(adAccountId, accessToken, {
      time_range: timeRange,
      time_increment: 1,
      fields: "spend,impressions,clicks,actions",
      level: "account",
    }),
    fetchInsights(adAccountId, accessToken, {
      time_range: timeRange,
      fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
      level: "campaign",
      limit: 100,
    }),
    fetchInsights(adAccountId, accessToken, {
      time_range: timeRange,
      fields: "ad_id,ad_name,campaign_name,spend,impressions,clicks,reach,actions,action_values",
      level: "ad",
    }),
    // Non-fatal: if this extra lookup fails, still show what insights has
    // rather than failing the whole page.
    fetchAccountAds(adAccountId, accessToken).catch((err) => {
      console.warn("[meta] fetchAccountAds failed:", err.message);
      return [];
    }),
  ]);

  const insightIds = new Set(insightAdRows.map((r) => r.ad_id).filter(Boolean));
  const rangeStartMs = new Date(isoDate(startDate)).getTime();
  const rangeEndMs = new Date(isoDate(endDate)).getTime() + DAY_MS;
  const undeliveredAds = accountAds.filter((ad) => {
    if (insightIds.has(ad.id)) return false;
    const created = ad.created_time ? new Date(ad.created_time).getTime() : null;
    if (created != null && created >= rangeEndMs) return false;
    if (ALWAYS_SHOWN_STATUSES.has(ad.effective_status)) return true;
    return created != null && created >= rangeStartMs;
  });

  const adRows = insightAdRows.concat(
    undeliveredAds.map((ad) => ({
      ad_id: ad.id,
      ad_name: ad.name,
      campaign_name: ad.campaign?.name || null,
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      actions: [],
      action_values: [],
    }))
  );

  const adIds = [...insightIds];
  const adMetaById = await fetchAdMetaByIds(adAccountId, adIds, accessToken);
  // The /ads lookup already carries status/adset/creative — reuse it so
  // undelivered ads (and any delivered ad the ID-filter lookup missed)
  // still get Status / Početak / Cena po danu filled in.
  accountAds.forEach((ad) => {
    if (!adMetaById.has(ad.id)) adMetaById.set(ad.id, ad);
  });

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

  // Every campaign that spent in the period (not just a top 10) so the page
  // can compare them side by side when moving budget. Revenue is in the
  // store's currency, like the per-ad revenue below; ROAS is computed by
  // the caller, which can convert it into the ad account's currency.
  const topCampaigns = campaignRows
    .map((r) => {
      const spend = toNumber(r.spend);
      const purchases = extractPurchases(r.actions);
      return {
        campaignId: r.campaign_id || null,
        campaign: r.campaign_name,
        spend,
        impressions: toNumber(r.impressions),
        clicks: toNumber(r.clicks),
        purchases,
        revenue: extractPurchaseRevenue(r.action_values),
        cpa: purchases > 0 ? spend / purchases : null,
      };
    })
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

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

module.exports = { listAdAccounts, testConnection, getPerformance };
