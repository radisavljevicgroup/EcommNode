// Shared Google OAuth (Authorization Code) plumbing for the GA4 and GSC
// "Poveži se sa Google nalogom" flows — replaces asking the merchant to
// create a service account in Google Cloud Console and paste its JSON key
// (still supported for reading data on connections made that way, see
// parseServiceAccount in googleServiceAuth.js, just no longer how NEW
// connections are made).
//
// The browser can't safely hold a client_secret, so unlike Meta's flow
// (whose FB.login() popup does the whole exchange client-side), the code
// the popup receives from Google is handed to THIS server, which does the
// code -> tokens exchange and everything downstream. See routes/googleOAuth.js
// for the callback that drives this.
const crypto = require("crypto");

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

function requireClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET nisu podešeni na serveru.");
  }
  return { clientId, clientSecret };
}

// One shared redirect URI for both GA4 and GSC (routes/googleOAuth.js) —
// which of the two a given flow belongs to travels in `state` instead, so
// only a single URI needs to be registered in Google Cloud Console's
// "Authorized redirect URIs" rather than one per integration.
function redirectUri() {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
  return `${base.replace(/\/+$/, "")}/api/google/oauth/callback`;
}

function buildAuthUrl(scope, state) {
  const { clientId } = requireClientCredentials();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  // Forces Google to hand back a refresh_token even for a merchant who
  // already granted this app access before (e.g. connecting a second GA4
  // property with the same Google account) — without it, a repeat consent
  // can come back with no refresh_token at all, since Google only issues
  // one on a account's first-ever consent for this app.
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret } = requireClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || "Razmena Google koda nije uspela.");
    err.status = res.status;
    throw err;
  }
  return data; // { access_token, refresh_token, expires_in, scope, token_type, id_token }
}

// Access tokens are valid for an hour — same caching reasoning as
// googleServiceAuth.js's getAccessToken, just keyed by refresh token
// instead of service account email.
const tokenCache = new Map();
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

async function getAccessTokenFromRefreshToken(refreshToken) {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const { clientId, clientSecret } = requireClientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.error_description || data.error || "Ne mogu da obnovim Google access token."
    );
    err.status = res.status;
    throw err;
  }

  tokenCache.set(refreshToken, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

async function fetchGoogleEmail(accessToken) {
  const res = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.email || null;
}

// Small in-memory TTL map used twice below: once for the `state` param
// (start -> callback, ties the callback back to which company/product
// requested it) and once for the connect-ready payload (callback ->
// connect, holds the refresh token server-side so it's never sent to the
// browser — same reasoning as a saved connection's serviceAccountJson
// never being sent back out, see routes/ga4.js's toPublic). Entries expire
// on their own so an abandoned popup doesn't leak memory.
function createTtlStore(ttlMs) {
  const map = new Map();
  function put(value) {
    const key = crypto.randomBytes(24).toString("hex");
    map.set(key, { value, expiresAt: Date.now() + ttlMs });
    return key;
  }
  function take(key) {
    const entry = map.get(key);
    if (!entry) return null;
    map.delete(key);
    if (entry.expiresAt < Date.now()) return null;
    return entry.value;
  }
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of map) {
      if (entry.expiresAt < now) map.delete(k);
    }
  }, 60_000).unref();
  return { put, take };
}

const STATE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const stateStore = createTtlStore(STATE_TTL_MS);
const pendingStore = createTtlStore(PENDING_TTL_MS);

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  getAccessTokenFromRefreshToken,
  fetchGoogleEmail,
  stashState: stateStore.put,
  takeState: stateStore.take,
  stashPending: pendingStore.put,
  takePending: pendingStore.take,
};
