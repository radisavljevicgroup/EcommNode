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
