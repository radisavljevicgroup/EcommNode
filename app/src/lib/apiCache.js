import { supabase } from "./supabaseClient";
import { noteResponse } from "./dataRefresh";

// Every page unmounts when you leave it, so coming back used to start from
// nothing: empty state, spinners, every request again — even though the
// server answers from its own caches in a fraction of a second. This keeps
// the last answer to each GET on our API in memory and, on the next visit,
// hands it back at once ("stale-while-revalidate"): the page renders with
// what it showed last time, the request goes to the server in the
// background, and if the answer changed, pages using useDataRefresh reload
// quietly with it (lib/dataRefresh.js) — the same mechanism the server's
// own background refreshes use.
//
// Installed once around window.fetch (main.jsx) so it covers every api/*.js
// helper and the premium modules' own api.js files (ecommnode-premium)
// without touching each of them.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const EVENT = "ecommnode:data-refreshed";

// An entry younger than this is served without asking the server again —
// covers a page's quiet reload right after a background revalidation.
const FRESH_MS = 15 * 1000;
// Older than this it's not shown at all (e.g. signed URLs, a tab left open
// for hours): the request goes straight to the server, as before.
const MAX_STALE_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;

// Polled, streamed or file endpoints: always live.
const SKIP = ["/sync-status", "/orders/last-change", "/inbox", "/messages", "/export", "/oauth", "/supabase/", "/auth"];

const cache = new Map(); // url -> { body, status, contentType, at }
const inFlight = new Map(); // url -> Promise<void>

function clearCache() {
  cache.clear();
}

// lib/orderChanges.js: an order came in — everything cached may show the old
// list/counts, so the next read of every page goes to the server.
export function clearApiCache() {
  cache.clear();
}

function isCacheable(url, method) {
  return (
    method === "GET" &&
    url.startsWith(API_BASE) &&
    !SKIP.some((s) => url.slice(API_BASE.length).includes(s))
  );
}

function remember(url, body, res) {
  cache.delete(url);
  cache.set(url, {
    body,
    status: res.status,
    contentType: res.headers.get("Content-Type") || "application/json",
    at: Date.now(),
    // The server was still refreshing when it answered: revalidate on the
    // next read instead of treating this as fresh.
    partial: res.headers.get("X-Data-Refreshing") === "1",
  });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

function toResponse(entry) {
  return new Response(entry.body, {
    status: entry.status,
    // lib/dataRefresh.js tells these apart from real server answers.
    headers: { "Content-Type": entry.contentType, "X-From-Cache": "1" },
  });
}

// Fetches from the network and stores a successful JSON answer. Returns a
// Response the caller can still read.
async function fetchAndStore(realFetch, url, init) {
  const res = await realFetch(url, init);
  const type = res.headers.get("Content-Type") || "";
  if (!res.ok || !type.includes("application/json")) return res;
  const body = await res.clone().text();
  remember(url, body, res);
  return res;
}

function revalidate(realFetch, url, init, previousBody) {
  if (inFlight.has(url)) return;
  const promise = fetchAndStore(realFetch, url, init)
    .then((res) => {
      noteResponse(res);
      const entry = cache.get(url);
      if (entry && entry.body !== previousBody) window.dispatchEvent(new Event(EVENT));
    })
    .catch(() => {})
    .finally(() => inFlight.delete(url));
  inFlight.set(url, promise);
}

export function installApiCache() {
  if (window.__ecommnodeApiCache) return;
  window.__ecommnodeApiCache = true;
  const realFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || String(input);
    const method = (init.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();

    if (!url.startsWith(API_BASE)) return realFetch(input, init);

    // Any write (connect, disconnect, settings, a status change...) can
    // change what the GETs return — drop everything rather than guess.
    if (method !== "GET") {
      clearCache();
      return realFetch(input, init);
    }
    if (!isCacheable(url, method)) return realFetch(input, init);

    const entry = cache.get(url);
    const age = entry ? Date.now() - entry.at : Infinity;
    if (entry && age < MAX_STALE_MS) {
      if (age >= FRESH_MS || entry.partial) revalidate(realFetch, url, init, entry.body);
      return Promise.resolve(toResponse(entry));
    }
    return fetchAndStore(realFetch, url, init);
  };

  // Another account on the same browser must never see the previous one's
  // cached data.
  let userId;
  supabase.auth.onAuthStateChange((_event, session) => {
    const next = session?.user?.id || null;
    if (next !== userId) clearCache();
    userId = next;
  });
}
