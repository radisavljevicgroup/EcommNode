import { authHeaders } from "../lib/authHeaders";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: await authHeaders(),
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Došlo je do greške.");
  }
  return data;
}

export function fetchInboxConnections() {
  return request("/inbox/connections");
}

export function connectInboxChannel(payload) {
  return request("/inbox/connections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectInboxChannel(id) {
  return request(`/inbox/connections/${id}/delete`, { method: "POST" });
}

// Step 2 of "Poveži se sa Facebook-om" — exchanges the short-lived user
// token from facebookLogin() (lib/facebookSdk.js) for the merchant's list
// of Pages + linked Instagram accounts, each already carrying its own
// long-lived Page Access Token ready to pass straight to
// connectInboxChannel above.
export function fetchManagedFacebookPages(accessToken) {
  return request("/inbox/oauth/facebook/pages", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
}
