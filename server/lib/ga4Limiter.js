// GA4 Data API allows at most 10 concurrent requests per property (standard
// properties). One page load can easily go past that on its own: the GA4 page
// fires getPerformance (4 reports) + getInsights (2), while Analitika's home
// cards, the dashboard, anomalies (2× getPerformance = 8), alerts and the
// sales funnel all hit the same property at the same time. Over the limit,
// Google answers "Exhausted concurrent requests quota" and the page shows it
// as an error.
//
// Every runReport (core lib/ga4.js and premium sales-funnel/ga4Funnel.js) goes
// through runLimited: a per-property queue that keeps well under the limit,
// plus a short retry with backoff in case another server process or the GA4
// UI itself is using the same property's quota at that moment.

const MAX_CONCURRENT_PER_PROPERTY = 4;
const RETRY_DELAYS_MS = [1000, 2500, 5000];

const slots = new Map(); // propertyId → { active, queue: [resolve] }

function acquire(propertyId) {
  if (!slots.has(propertyId)) slots.set(propertyId, { active: 0, queue: [] });
  const s = slots.get(propertyId);
  if (s.active < MAX_CONCURRENT_PER_PROPERTY) {
    s.active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => s.queue.push(resolve));
}

function release(propertyId) {
  const s = slots.get(propertyId);
  if (!s) return;
  const next = s.queue.shift();
  if (next) next(); // hand the slot straight to the next waiter
  else s.active -= 1;
}

// 429 / RESOURCE_EXHAUSTED covers both the concurrent-requests quota (frees
// up within seconds) and the hourly/daily token quotas (doesn't) — only the
// concurrent one is worth retrying.
function isConcurrencyError(err) {
  return err && err.status === 429 && /concurrent/i.test(err.message || "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runLimited(propertyId, fn) {
  for (let attempt = 0; ; attempt += 1) {
    await acquire(propertyId);
    try {
      return await fn();
    } catch (err) {
      if (!isConcurrencyError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
    } finally {
      release(propertyId);
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

module.exports = { runLimited };
