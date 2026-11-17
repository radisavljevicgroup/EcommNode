const { AsyncLocalStorage } = require("async_hooks");

// "Answer now, refresh in the background": routes answer at once from what's
// stored (orders cache, Meta/GA4 daily stores, report caches) instead of
// waiting for the store/Meta/GA4 to answer. A refresh started (or joined)
// while handling a request is registered here with trackRefresh; if any of
// them is still running when the route responds, the response carries
// X-Data-Refreshing: 1 and the frontend (app/src/lib/dataRefresh.js) quietly
// reloads the page's data a few seconds later, when the refresh has landed.
//
// Only short refreshes belong here (recent orders, last days of Meta/GA4,
// expired report caches) — not the WooCommerce history backfill, which can
// run for minutes and would keep pages reloading.

const als = new AsyncLocalStorage();

function trackRefresh(promise) {
  const pending = als.getStore();
  if (!pending || !promise || typeof promise.then !== "function") return promise;
  const entry = { done: false };
  pending.add(entry);
  const done = () => {
    entry.done = true;
  };
  promise.then(done, done);
  return promise;
}

function refreshTrackerMiddleware(req, res, next) {
  const pending = new Set();
  const json = res.json.bind(res);
  res.json = (body) => {
    if ([...pending].some((e) => !e.done)) res.set("X-Data-Refreshing", "1");
    return json(body);
  };
  als.run(pending, () => next());
}

module.exports = { trackRefresh, refreshTrackerMiddleware };
