import { authHeaders } from "../lib/authHeaders";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
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

// Same endpoint, but anchored to an explicit [from, to] (e.g. a
// DateRangePicker selection) and a multi-brand connectionIds list instead
// of the rolling days-from-now window above — used by ManagerHome.jsx.
export function fetchDashboardSummaryForRange({ connectionIds, from, to } = {}) {
  const params = new URLSearchParams();
  if (connectionIds?.length) params.set("connectionIds", connectionIds.join(","));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/dashboard/summary?${params.toString()}`);
}

export function fetchDashboardAnomalies(days = 7, connectionId) {
  const params = new URLSearchParams({ days });
  if (connectionId) params.set("connectionId", connectionId);
  return request(`/dashboard/anomalies?${params.toString()}`);
}
