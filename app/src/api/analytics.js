const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Došlo je do greške.");
  }
  return data;
}

function buildQuery({ connectionIds, from, to }) {
  const params = new URLSearchParams();
  if (connectionIds?.length) params.set("connectionIds", connectionIds.join(","));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return params.toString();
}

export function fetchAnalyticsSummary(filters) {
  return request(`/analytics/summary?${buildQuery(filters)}`);
}

export function fetchAnalyticsTrends(filters) {
  return request(`/analytics/trends?${buildQuery(filters)}`);
}

export function fetchTopProducts(filters) {
  return request(`/analytics/top-products?${buildQuery(filters)}`);
}

export function fetchGeoDistribution(filters) {
  return request(`/analytics/geo?${buildQuery(filters)}`);
}

export function fetchSyncStatus(filters) {
  return request(`/analytics/sync-status?${buildQuery(filters)}`);
}

export async function triggerSync(filters) {
  const params = buildQuery(filters);
  const res = await fetch(`${API_BASE}/analytics/sync?${params}`, { method: "POST" });
  return res.json();
}
