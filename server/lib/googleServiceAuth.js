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

async function getAccessToken(serviceAccount, scope) {
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
  return data.access_token;
}

module.exports = { parseServiceAccount, getAccessToken };
