const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Došlo je do greške.");
  }
  return data;
}

export function connectGsc(payload) {
  return request("/gsc/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectGsc(id) {
  return request("/gsc/disconnect", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export function fetchGscStatus() {
  return request("/gsc/status");
}

export function fetchGscPerformance(id, from, to) {
  const params = new URLSearchParams({ id });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request(`/gsc/performance?${params.toString()}`);
}
