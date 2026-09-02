// Minimal Google OAuth2 service-account (JWT Bearer) flow using only
// Node's built-in crypto — no need for the full google-auth-library
// dependency just to mint a bearer token from a service account key.
const crypto = require("crypto");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function parseServiceAccount(raw) {
  let json;
  try {
    json = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Service account JSON nije validan JSON.");
  }
  if (!json?.client_email || !json?.private_key) {
    throw new Error("Service account JSON mora sadržati client_email i private_key.");
  }
  return json;
}

// Access tokens are valid for an hour — without this cache, every single
// GA4 report call paid for a full JWT-sign + OAuth round-trip first, which
// was a meaningful chunk of "Analiza prodaje"'s load time on its own.
const tokenCache = new Map();
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

async function getAccessToken(serviceAccount, scope) {
  const cacheKey = `${serviceAccount.client_email}::${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  let signature;
  try {
    signature = base64url(signer.sign(serviceAccount.private_key));
  } catch {
    throw new Error("private_key iz service account JSON-a nije validan privatni ključ.");
  }
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data.error_description || data.error || "Ne mogu da dobijem Google access token."
    );
    err.status = res.status;
    throw err;
  }

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

module.exports = { parseServiceAccount, getAccessToken };
