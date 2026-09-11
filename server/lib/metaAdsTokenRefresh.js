const metaStore = require("./metaStore");
const metaMessaging = require("./metaMessaging");

const DAY_MS = 24 * 60 * 60 * 1000;
// Meta's long-lived user token lasts ~60 days — refreshing once it's
// within 15 days of expiry leaves a wide margin against a missed tick
// (a restart, a slow network day) still landing well before the token
// actually goes stale.
const REFRESH_WINDOW_MS = 15 * DAY_MS;

// No tokenExpiresAt means this connection predates the OAuth flow (a
// manually pasted System User token, which doesn't expire) — never
// swept into refresh, since handing a non-expiring token to the
// fb_exchange_token grant isn't a case Meta's OAuth endpoint is meant for
// and would just fail on every tick forever instead of doing nothing.
function isDueForRefresh(connection) {
  if (!connection.tokenExpiresAt) return false;
  return new Date(connection.tokenExpiresAt).getTime() - Date.now() <= REFRESH_WINDOW_MS;
}

// Every Meta Ads connection across every company, one at a time — same
// "don't let one bad token abort the rest, sequential to stay gentle on
// Meta's API" reasoning as Eurocom's and stock-control's schedulers.
async function refreshDueTokens() {
  const due = metaStore.getAllConnections().filter(isDueForRefresh);
  if (due.length === 0) return;
  for (const connection of due) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { accessToken, expiresIn } = await metaMessaging.exchangeForLongLivedUserTokenWithExpiry(
        connection.accessToken
      );
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      metaStore.updateConnection(connection.id, connection.company, { accessToken, tokenExpiresAt });
      console.error(`[meta-ads-token-refresh] ${connection.label}: token osvežen, važi do ${tokenExpiresAt}`);
    } catch (err) {
      // A user who changed their Facebook password or revoked the app
      // fails here every tick until they reconnect — next tick retries,
      // same as a transient network error, rather than giving up on it.
      console.error(`[meta-ads-token-refresh] ${connection.label} nije uspelo:`, err.message);
    }
  }
}

// Runs unconditionally (no *_AUTOSYNC env gate, unlike Eurocom/stock-control)
// — this only refreshes OUR OWN stored token against Meta's OAuth endpoint,
// never writes to a merchant's store, so there's no risk of a dev machine
// and production colliding on the same external system the way there is
// for those two.
function startScheduler() {
  console.error("[meta-ads-token-refresh] pokrenut (provera na 24h, osvežava tokene unutar 15 dana od isteka)");
  refreshDueTokens();
  setInterval(refreshDueTokens, DAY_MS);
}

module.exports = { startScheduler, refreshDueTokens };
