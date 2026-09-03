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

export function connectMeta(payload) {
  return request("/meta/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMetaStores(id, targetConnectionIds) {
  return request("/meta/update-stores", {
    method: "POST",
    body: JSON.stringify({ id, targetConnectionIds }),
  });
}

export function disconnectMeta(id) {
  return request("/meta/disconnect", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export function fetchMetaStatus() {
  return request("/meta/status");
}

export function fetchMetaPerformance(id, from, to) {
  const params = new URLSearchParams({ id });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/meta/performance?${params.toString()}`);
}
