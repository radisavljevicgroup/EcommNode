const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const fx = require("./currency");

const DEFAULT_DAYS = 28;
const DAY_MS = 1000 * 60 * 60 * 24;

// Meta's purchase value (action_values) doesn't come back in one currency
// for every campaign: a pixel that sends the store's currency properly
// gets converted by Meta into the ad account's currency (EUR), while a
// pixel that sends RSD amounts without a currency (or tagged with the
// account's) comes back as raw RSD numbers. Seen on the same account in
// 2026-11: "Showroom akcija Sales" 5,120 per purchase (RSD — matches the
// stores' ~2,700-5,900 RSD average order), "Papagaj Crni novembar" 40.7
// per purchase (EUR — 40 RSD per order is impossible). Assuming RSD for
// all of them made Papagaj's ROAS 0.07× instead of ~8×.
//
// RSD and EUR differ ~117×, so the value per purchase tells them apart:
// these stores' orders are ~20-100 EUR, i.e. ~2,300-12,000 RSD. Anything
// at or above this threshold per purchase is RSD, below it EUR.
const RSD_PER_PURCHASE_THRESHOLD = 500;

// Adds revenueCurrency (what `revenue` is actually in), revenueInAccount
// (revenue in the ad account's currency), roas and profit (both in the ad
// account's currency). Only EUR ad accounts get the per-row guess; any
// other account currency is taken as what Meta reported in.
function withRevenueCurrency(row, spend, accountCurrency, rsdPerEur) {
  const { revenue, purchases } = row;
  let revenueCurrency = accountCurrency;
  let revenueInAccount = revenue;
  if (accountCurrency === "EUR" && revenue > 0) {
    // Purchase value with no purchase count (rare) — the per-purchase test
    // can't run; RSD was the previous assumption for everything.
    const perPurchase = purchases > 0 ? revenue / purchases : Infinity;
    if (perPurchase >= RSD_PER_PURCHASE_THRESHOLD) {
      revenueCurrency = "RSD";
      revenueInAccount = revenue / rsdPerEur;
    }
  }
  return {
    ...row,
    revenueCurrency,
    revenueInAccount,
    roas: spend > 0 ? revenueInAccount / spend : null,
    profit: revenueInAccount - spend,
  };
}

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
// A Graph API page that hasn't answered in 30s is given up on, so one stuck
// call can't hold a whole page (or the home cards) open indefinitely.
const GRAPH_TIMEOUT_MS = 30 * 1000;

// Meta throttles per ad account ("There have been too many calls to this
// ad-account", code 17 / 80004...). Seen on production 2026-11-13: every
// call kept failing, the home page's catch swallowed it and showed 0 spend,
// and every page load kept hitting Meta again, which keeps the limit going.
// Once Meta says so, stop calling that account until it should have
// recovered (Meta's own estimate when it sends one) and fail fast instead.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const DEFAULT_RATE_LIMIT_PAUSE_MS = 15 * 60 * 1000;
const rateLimitedUntil = new Map(); // ad account id -> ms

function accountIdFromUrl(url) {
  const m = String(url).match(/act_(\d+)/);
  return m ? m[1] : null;
}

function isRateLimitError(error) {
  if (!error) return false;
  const code = Number(error.code);
  return RATE_LIMIT_CODES.has(code) || (code >= 80000 && code <= 80014) || /too many calls/i.test(error.message || "");
}

// Meta's estimate (minutes) from x-business-use-case-usage, if it sent one.
function regainAccessMs(res) {
  try {
    const usage = JSON.parse(res.headers.get("x-business-use-case-usage") || "{}");
    const minutes = Math.max(
      0,
      ...Object.values(usage)
        .flat()
        .map((u) => Number(u?.estimated_time_to_regain_access) || 0)
    );
    return minutes > 0 ? minutes * 60 * 1000 : null;
  } catch {
    return null;
  }
}

function rateLimitedError(untilMs) {
  const minutes = Math.max(1, Math.ceil((untilMs - Date.now()) / 60000));
  const e = new Error(
    `Meta je privremeno ograničila broj upita za ovaj oglasni nalog — podaci će se ponovo učitati za ~${minutes} min.`
  );
  e.status = 429;
  e.rateLimited = true;
  return e;
}

async function graphFetch(url) {
  const accountId = accountIdFromUrl(url);
  const pausedUntil = accountId ? rateLimitedUntil.get(accountId) : null;
  if (pausedUntil && pausedUntil > Date.now()) throw rateLimitedError(pausedUntil);

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      const e = new Error(`Meta nije odgovorila za ${GRAPH_TIMEOUT_MS / 1000}s — pokušaj ponovo malo kasnije.`);
      e.status = 504;
      throw e;
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    if (accountId && isRateLimitError(data.error)) {
      const until = Date.now() + (regainAccessMs(res) || DEFAULT_RATE_LIMIT_PAUSE_MS);
      rateLimitedUntil.set(accountId, until);
      console.warn(`[meta] ad account ${accountId} rate-limited until ${new Date(until).toISOString()}`);
      throw rateLimitedError(until);
    }
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
// object_type plus every place a creative can keep its website link —
// destinationHost() below reads them to tell which store an ad sells for.
const CREATIVE_FIELDS =
  "creative{object_type,link_url,object_url,object_story_spec{link_data{link},video_data{call_to_action{value{link}}},template_data{link}},asset_feed_spec{link_urls{website_url}}}";

function normalizeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// The website an ad sends people to (e.g. "papagaj.rs"), or null for ads
// with no website link (profile visits, messages, page likes...).
function destinationHost(creative) {
  if (!creative) return null;
  const spec = creative.object_story_spec || {};
  const candidates = [
    spec.link_data?.link,
    spec.video_data?.call_to_action?.value?.link,
    spec.template_data?.link,
    ...(creative.asset_feed_spec?.link_urls || []).map((l) => l.website_url),
    creative.link_url,
    creative.object_url,
  ];
  for (const url of candidates) {
    const host = url && normalizeHost(url);
    // object_url is often the Facebook/Instagram post itself, not a store.
    if (host && !/(^|\.)(facebook|instagram|fb)\.(com|me)$/.test(host)) return host;
  }
  return null;
}

function hostsMatch(a, b) {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

// Which of a Meta connection's target stores an ad belongs to — so one ad
// account running ads for several stores (papagaj.rs, parkerolovke.rs...)
// can be split per store for ROAS/MER. A connection that targets a single
// store gets every ad; otherwise the ad's website link decides, and an ad
// whose link matches none of them (or has none) returns null.
// `stores` = the company's store connections ({ id, siteUrl }).
function adStoreId(ad, connection, stores) {
  const targets = connection.targetConnectionIds || [];
  if (targets.length === 1) return targets[0];
  if (!ad.destinationHost) return null;
  const match = stores.find(
    (s) => targets.includes(s.id) && normalizeHost(s.siteUrl) && hostsMatch(normalizeHost(s.siteUrl), ad.destinationHost)
  );
  return match ? match.id : null;
}

async function fetchAdMetaByIds(adAccountId, adIds, accessToken) {
  if (!adIds.length) return new Map();
  const fields = `id,effective_status,adset{daily_budget,lifetime_budget,start_time,end_time},${CREATIVE_FIELDS}`;

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
    `id,name,created_time,effective_status,campaign{name},adset{daily_budget,lifetime_budget,start_time,end_time},${CREATIVE_FIELDS}`
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

// ---- Local daily store ------------------------------------------------------
//
// Every page used to ask Meta for its own range: the Meta Ads page (4 calls +
// lookups), the home cards (current + previous period), anomalies, CAC, the
// LTV/CAC alert — again for every store filter, date preset and quarter, and
// again after every restart (in-memory cache). On 2026-11-13 that kept the ad
// account at Meta's rate limit ("too many calls to this ad-account") for most
// of the day.
//
// Now ad-level insights are kept per day on disk (server/data/
// meta-insights.json, like orders-cache.json), and every range is computed
// locally from them. Meta is only asked for:
//   - days never fetched yet (once — a range older than what's stored), and
//   - the last RECENT_DAYS days, at most every RECENT_REFRESH_MS (Meta's
//     attribution keeps changing for a day or two),
// plus ad details (status/budget: hourly, Meta Ads page only; website link:
// once per ad) and unique reach for the Meta Ads page's range (cached).
// While Meta is throttling, everything is served from what's stored.

const { createJsonFile } = require("./jsonFile");

const insightsFile = createJsonFile("meta-insights.json", {});
let store = insightsFile.read();

const RECENT_DAYS = 3;
const RECENT_REFRESH_MS = 30 * 60 * 1000;
// A request for a period whose recent days are stale waits this long for the
// refresh, then answers from what's stored (the refresh still lands).
const RECENT_WAIT_MS = 8000;
// Longest window asked for in one call — a year of daily ad rows in one go is
// what Meta answers slowest.
const FETCH_CHUNK_DAYS = 92;
const AD_DETAILS_TTL_MS = 60 * 60 * 1000;

let writeTimer = null;
function saveStore() {
  // Several chunks/refreshes can land within moments — write once.
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    insightsFile.write(store);
  }, 500);
}

function account(connection) {
  const id = String(connection.adAccountId);
  if (!store[id]) store[id] = { from: null, to: null, recentAt: null, days: {}, ads: {} };
  return store[id];
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

function eachDay(since, until, fn) {
  for (let d = since; d <= until; d = addDays(d, 1)) fn(d);
}

// One request at a time per ad account, in order — several pages loading at
// once otherwise fire their calls in parallel bursts.
const accountLocks = new Map();
function withAccountLock(connection, fn) {
  const id = String(connection.adAccountId);
  const prev = accountLocks.get(id) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  accountLocks.set(id, run.catch(() => {}));
  return run;
}

function compactRow(r) {
  return {
    ad: r.ad_id || null,
    name: r.ad_name || null,
    cid: r.campaign_id || null,
    campaign: r.campaign_name || null,
    spend: toNumber(r.spend),
    impr: toNumber(r.impressions),
    clicks: toNumber(r.clicks),
    purch: extractPurchases(r.actions),
    value: extractPurchaseRevenue(r.action_values),
    follows: extractFollows(r.actions),
  };
}

// Fetches [since, until] day by day at ad level and replaces those days in
// the store (a day with no rows is stored as [] — "fetched, nothing ran").
async function fetchDays(connection, since, until) {
  const acct = account(connection);
  for (let start = since; start <= until; start = addDays(start, FETCH_CHUNK_DAYS)) {
    const end = addDays(start, FETCH_CHUNK_DAYS - 1) < until ? addDays(start, FETCH_CHUNK_DAYS - 1) : until;
    // eslint-disable-next-line no-await-in-loop
    const rows = await fetchInsights(connection.adAccountId, connection.accessToken, {
      time_range: JSON.stringify({ since: start, until: end }),
      time_increment: 1,
      fields: "ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
      level: "ad",
    });
    const byDay = {};
    eachDay(start, end, (d) => {
      byDay[d] = [];
    });
    rows.forEach((r) => {
      if (byDay[r.date_start]) byDay[r.date_start].push(compactRow(r));
    });
    Object.assign(acct.days, byDay);
    if (!acct.from || start < acct.from) acct.from = start;
    if (!acct.to || end > acct.to) acct.to = end;
    // A fetch that reached today already is a fresh recent refresh.
    if (end >= todayStr() && start <= addDays(todayStr(), -(RECENT_DAYS - 1))) acct.recentAt = new Date().toISOString();
    saveStore();
  }
}

function todayStr() {
  return isoDate(new Date());
}

// Days of [since, until] never fetched — at most two spans (before and after
// what's stored), since the store always grows as one contiguous range.
function missingSpans(acct, since, until) {
  const today = todayStr();
  const end = until > today ? today : until;
  if (since > end) return [];
  if (!acct.from) return [[since, end]];
  const spans = [];
  if (since < acct.from) spans.push([since, addDays(acct.from, -1) < end ? addDays(acct.from, -1) : end]);
  if (end > acct.to) spans.push([addDays(acct.to, 1) > since ? addDays(acct.to, 1) : since, end]);
  return spans;
}

const recentInflight = new Map();
function refreshRecent(connection) {
  const id = String(connection.adAccountId);
  if (recentInflight.has(id)) return recentInflight.get(id);
  const p = withAccountLock(connection, async () => {
    const acct = account(connection);
    if (acct.recentAt && Date.now() - Date.parse(acct.recentAt) < RECENT_REFRESH_MS) return;
    const today = todayStr();
    await fetchDays(connection, addDays(today, -(RECENT_DAYS - 1)), today);
    acct.recentAt = new Date().toISOString();
    saveStore();
  }).finally(() => recentInflight.delete(id));
  recentInflight.set(id, p);
  return p;
}

// Stored ad rows for [since, until] (one entry per ad per day). Fetches only
// what isn't stored; a failed fetch (rate limit...) still answers from the
// store if it has anything for the range, otherwise throws.
async function dailyRows(connection, range) {
  const { since, until } = resolveRange(range);
  const acct = account(connection);

  const spans = missingSpans(acct, since, until);
  if (spans.length) {
    try {
      await withAccountLock(connection, async () => {
        // Re-check inside the lock: another request may have just fetched them.
        for (const [s, e] of missingSpans(account(connection), since, until)) {
          // eslint-disable-next-line no-await-in-loop
          await fetchDays(connection, s, e);
        }
      });
    } catch (err) {
      const anyStored = acct.from && acct.from <= until && acct.to >= since;
      if (!anyStored) throw err;
      console.warn("[meta] serving stored insights, fetch failed:", err.message);
    }
  }

  if (until >= addDays(todayStr(), -(RECENT_DAYS - 1))) {
    const refresh = refreshRecent(connection).catch((err) =>
      console.warn("[meta] recent insights refresh failed:", err.message)
    );
    await Promise.race([refresh, new Promise((resolve) => setTimeout(resolve, RECENT_WAIT_MS))]);
  }

  const out = [];
  eachDay(since, until, (d) => {
    (account(connection).days[d] || []).forEach((row) => out.push({ date: d, ...row }));
  });
  return out;
}

// Ad details: website link (never changes — fetched once per ad) and, for
// the Meta Ads page, status / adset budget & schedule / creative type, plus
// every listed-status ad of the account (the not-yet-delivered ones), at most
// hourly. Stored with the insights so a restart doesn't refetch them.
async function adDetails(connection, adIds, { full = false } = {}) {
  const acct = account(connection);
  const ads = acct.ads || (acct.ads = {});
  try {
    await withAccountLock(connection, async () => {
      if (full && (!acct.adsListAt || Date.now() - Date.parse(acct.adsListAt) > AD_DETAILS_TTL_MS)) {
        const listed = await fetchAccountAds(connection.adAccountId, connection.accessToken);
        const at = new Date().toISOString();
        listed.forEach((ad) => {
          ads[ad.id] = { ...ads[ad.id], ...ad, at };
        });
        acct.listedAdIds = listed.map((ad) => ad.id);
        acct.adsListAt = at;
        saveStore();
      }
      const missing = adIds.filter((id) => {
        const a = ads[id];
        if (!a || a.creative === undefined) return true;
        return full && (!a.at || Date.now() - Date.parse(a.at) > AD_DETAILS_TTL_MS);
      });
      if (missing.length) {
        const fetched = await fetchAdMetaByIds(connection.adAccountId, missing, connection.accessToken);
        const at = new Date().toISOString();
        missing.forEach((id) => {
          // Not returned (deleted ad) — remember that, so it isn't asked again.
          ads[id] = { ...ads[id], ...(fetched.get(id) || {}), creative: fetched.get(id)?.creative || ads[id]?.creative || null, at };
        });
        saveStore();
      }
    });
  } catch (err) {
    console.warn("[meta] ad details from store, fetch failed:", err.message);
  }
  return ads;
}

// Unique reach per ad can't be summed from days — the Meta Ads page asks for
// its range once and keeps it (finished ranges for hours).
const reachCache = new Map();
async function reachByAd(connection, range) {
  const { since, until } = resolveRange(range);
  const key = `${connection.adAccountId}::${since}::${until}`;
  const ttl = until < addDays(todayStr(), -2) ? PAST_RANGE_CACHE_TTL_MS : RECENT_REFRESH_MS;
  const cached = reachCache.get(key);
  if (cached && Date.now() - cached.at < ttl) return cached.map;
  try {
    const rows = await withAccountLock(connection, () =>
      fetchInsights(connection.adAccountId, connection.accessToken, {
        time_range: JSON.stringify({ since, until }),
        fields: "ad_id,reach",
        level: "ad",
      })
    );
    const map = new Map(rows.map((r) => [r.ad_id, toNumber(r.reach)]));
    reachCache.set(key, { map, at: Date.now() });
    return map;
  } catch (err) {
    console.warn("[meta] reach unavailable:", err.message);
    return cached?.map || null;
  }
}

const PAST_RANGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function resolveRange({ from, to } = {}) {
  const endDate = to ? new Date(to) : new Date();
  const startDate = from ? new Date(from) : new Date(endDate.getTime() - DEFAULT_DAYS * DAY_MS);
  return { startDate, endDate, since: isoDate(startDate), until: isoDate(endDate) };
}

function sumBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const key = keyFn(r);
    const acc = map.get(key) || { spend: 0, impr: 0, clicks: 0, purch: 0, value: 0, follows: 0, first: r };
    acc.spend += r.spend;
    acc.impr += r.impr;
    acc.clicks += r.clicks;
    acc.purch += r.purch;
    acc.value += r.value;
    acc.follows += r.follows;
    map.set(key, acc);
  });
  return map;
}

async function getPerformance(connection, range = {}) {
  const { startDate, endDate, since, until } = resolveRange(range);
  const rows = await dailyRows(connection, range);

  const byDay = sumBy(rows, (r) => r.date);
  const trend = [];
  eachDay(since, until > todayStr() ? todayStr() : until, (d) => {
    const t = byDay.get(d);
    if (t) trend.push({ date: d, spend: t.spend, impressions: t.impr, clicks: t.clicks, purchases: t.purch });
  });

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

  const currency = connection.currency || null;
  const rsdPerEur = await fx.getRsdPerEur();

  // Every campaign that spent in the period, so the page can compare them
  // side by side when moving budget.
  const topCampaigns = [...sumBy(rows, (r) => r.cid || r.campaign || "").values()]
    .map((c) => ({
      campaignId: c.first.cid,
      campaign: c.first.campaign,
      spend: c.spend,
      impressions: c.impr,
      clicks: c.clicks,
      purchases: c.purch,
      revenue: c.value,
      cpa: c.purch > 0 ? c.spend / c.purch : null,
    }))
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .map((c) => withRevenueCurrency(c, c.spend, currency, rsdPerEur));

  const byAd = sumBy(rows, (r) => r.ad);
  const deliveredIds = [...byAd.keys()].filter(Boolean);
  const [ads, reach] = await Promise.all([
    adDetails(connection, deliveredIds, { full: true }),
    reachByAd(connection, range),
  ]);

  // /insights only has ads that delivered — add the account's current ads
  // that haven't (in review, scheduled...) with zero metrics.
  const rangeStartMs = new Date(since).getTime();
  const rangeEndMs = new Date(until).getTime() + DAY_MS;
  const undelivered = (account(connection).listedAdIds || [])
    .filter((id) => !byAd.has(id))
    .map((id) => ads[id])
    .filter((ad) => {
      if (!ad) return false;
      const created = ad.created_time ? new Date(ad.created_time).getTime() : null;
      if (created != null && created >= rangeEndMs) return false;
      if (ALWAYS_SHOWN_STATUSES.has(ad.effective_status)) return true;
      return created != null && created >= rangeStartMs;
    });

  const adEntries = [
    ...[...byAd.entries()].map(([id, a]) => ({ id, a, name: a.first.name, campaign: a.first.campaign })),
    ...undelivered.map((ad) => ({
      id: ad.id,
      a: { spend: 0, impr: 0, clicks: 0, purch: 0, value: 0, follows: 0 },
      name: ad.name,
      campaign: ad.campaign?.name || null,
    })),
  ];

  const allAds = adEntries
    .map(({ id, a, name, campaign }) => {
      const meta = ads[id] || {};
      const adset = meta.adset || {};
      const start = adset.start_time || null;
      const end = adset.end_time || null;
      // Still-running ads have no end_time — count elapsed days up to now.
      const days = start ? Math.max(1, Math.ceil((new Date(end || Date.now()) - new Date(start)) / DAY_MS)) : null;
      // Meta returns budgets in the account's minor currency unit (cents).
      // Lifetime budgets are spread over the run for a daily figure.
      const dailyBudget =
        adset.daily_budget != null
          ? toNumber(adset.daily_budget) / 100
          : adset.lifetime_budget != null && days
            ? toNumber(adset.lifetime_budget) / 100 / days
            : null;
      const spend = a.spend;
      return withRevenueCurrency(
        {
          adId: id || null,
          destinationHost: destinationHost(meta.creative),
          adName: name,
          campaign,
          status: meta.effective_status === "ACTIVE" ? "active" : "inactive",
          start,
          pricePerDay: dailyBudget,
          days,
          total: spend,
          adType: meta.creative?.object_type || null,
          // null when Meta couldn't be asked for this range's unique reach.
          reach: reach ? reach.get(id) ?? 0 : null,
          impressions: a.impr,
          clicks: a.clicks,
          follows: a.follows,
          purchases: a.purch,
          revenue: a.value,
          ctr: a.impr > 0 ? (a.clicks / a.impr) * 100 : 0,
          cpc: a.clicks > 0 ? spend / a.clicks : 0,
          // null (not 0) when there were no follows/purchases — 0 would read
          // as "free acquisition" instead of "not applicable here".
          cpf: a.follows > 0 ? spend / a.follows : null,
          cpa: a.purch > 0 ? spend / a.purch : null,
        },
        spend,
        currency,
        rsdPerEur
      );
    })
    .sort((x, y) => y.total - x.total);

  return {
    dateRange: { startDate: isoDate(startDate), endDate: isoDate(endDate) },
    currency,
    totals,
    trend,
    topCampaigns,
    allAds,
  };
}

// Account spend per day (and total), for CAC / anomalies — from the store.
async function getSpendTotals(connection, range = {}) {
  const { since, until } = resolveRange(range);
  const rows = await dailyRows(connection, range);
  const byDay = sumBy(rows, (r) => r.date);
  const trend = [...byDay.entries()]
    .map(([date, t]) => ({ date, spend: t.spend }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    dateRange: { startDate: since, endDate: until },
    currency: connection.currency || null,
    totals: { spend: trend.reduce((sum, r) => sum + r.spend, 0) },
    trend,
  };
}

// Ads that spent in the range: spend, purchases, purchase value (in the ad
// account's currency) and website link (so adStoreId can split one account
// between stores), plus spend/purchases per campaign for the CPA-spike
// anomaly. From the store; only never-seen ads' links are fetched.
async function getAdSummary(connection, range = {}) {
  const { since, until } = resolveRange(range);
  const rows = await dailyRows(connection, range);
  const byAd = sumBy(rows, (r) => r.ad);
  const ads = await adDetails(connection, [...byAd.keys()].filter(Boolean));

  const currency = connection.currency || null;
  const rsdPerEur = await fx.getRsdPerEur();
  const allAds = [...byAd.entries()]
    .map(([id, a]) =>
      withRevenueCurrency(
        {
          adId: id || null,
          destinationHost: destinationHost(ads[id]?.creative),
          campaign: a.first.campaign,
          total: a.spend,
          purchases: a.purch,
          revenue: a.value,
        },
        a.spend,
        currency,
        rsdPerEur
      )
    )
    .sort((x, y) => y.total - x.total);

  const byCampaign = new Map();
  allAds.forEach((ad) => {
    const key = ad.campaign || "";
    if (!byCampaign.has(key)) byCampaign.set(key, { campaign: ad.campaign, spend: 0, purchases: 0 });
    const c = byCampaign.get(key);
    c.spend += ad.total;
    c.purchases += ad.purchases;
  });

  return {
    dateRange: { startDate: since, endDate: until },
    currency,
    totals: { spend: allAds.reduce((sum, ad) => sum + ad.total, 0) },
    allAds,
    topCampaigns: [...byCampaign.values()].filter((c) => c.spend > 0).sort((a, b) => b.spend - a.spend),
  };
}

module.exports = { listAdAccounts, testConnection, getPerformance, getSpendTotals, getAdSummary, adStoreId };
