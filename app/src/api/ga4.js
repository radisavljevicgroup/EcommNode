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

export function connectGa4(payload) {
  return request("/ga4/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectGa4(id) {
  return request("/ga4/disconnect", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export function fetchGa4Status() {
  return request("/ga4/status");
}

export function fetchGa4Performance(id, from, to) {
  const params = new URLSearchParams({ id });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/ga4/performance?${params.toString()}`);
}
