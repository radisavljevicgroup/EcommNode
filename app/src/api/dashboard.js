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
//
// parts: "core" = orders/revenue/logistics only (answers at once, from the
// orders cache), "ads" = Meta spend/ROAS/MER + conversion rate (Meta and GA4,
// slower), omitted = both.
export function fetchDashboardSummaryForRange({ connectionIds, from, to, parts } = {}) {
  const params = new URLSearchParams();
  if (connectionIds?.length) params.set("connectionIds", connectionIds.join(","));
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (parts) params.set("parts", parts);
  return request(`/dashboard/summary?${params.toString()}`);
}

// Both halves in parallel: onCore gets the order numbers as soon as they're
// there (ad fields null), the returned promise resolves with the full
// summary once Meta/GA4 answered — or with the core alone if that part failed.
export async function fetchDashboardSummaryProgressive(filters, onCore) {
  const core = fetchDashboardSummaryForRange({ ...filters, parts: "core" });
  const ads = fetchDashboardSummaryForRange({ ...filters, parts: "ads" }).catch(() => null);
  const coreData = await core;
  onCore?.(coreData);
  const adsData = await ads;
  if (!adsData) return coreData;
  return {
    ...coreData,
    metaCurrency: adsData.metaCurrency,
    adSpend: adsData.adSpend,
    roas: adsData.roas,
    mer: adsData.mer,
    adSpendUnattributed: adsData.adSpendUnattributed,
    metaError: adsData.metaError || null,
    conversionRate: adsData.conversionRate,
  };
}

export function fetchDashboardAnomalies(days = 7, connectionId) {
  const params = new URLSearchParams({ days });
  if (connectionId) params.set("connectionId", connectionId);
  return request(`/dashboard/anomalies?${params.toString()}`);
}
