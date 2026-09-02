const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Došlo je do greške.");
  }
  return data;
}

export function fetchDashboardSummary(days = 7, connectionId) {
  const params = new URLSearchParams({ days });
  if (connectionId) params.set("connectionId", connectionId);
  return request(`/dashboard/summary?${params.toString()}`);
}

export function fetchDashboardAnomalies(days = 7, connectionId) {
  const params = new URLSearchParams({ days });
  if (connectionId) params.set("connectionId", connectionId);
  return request(`/dashboard/anomalies?${params.toString()}`);
}
