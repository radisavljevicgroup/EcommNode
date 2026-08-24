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

export function connectWoo(payload) {
  return request("/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchWooStatus() {
  return request("/status");
}

export function disconnectWoo(id) {
  return request("/disconnect", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export function fetchWooOrders(
  connectionId,
  { page = 1, perPage = 10, search = "", stale = false, status } = {}
) {
  const params = new URLSearchParams();
  if (connectionId) params.set("connectionId", connectionId);
  params.set("page", page);
  params.set("perPage", perPage);
  if (search) params.set("search", search);
  if (stale) params.set("stale", "true");
  // Sent even when empty — an empty (but present) list means "every status
  // deselected", which must match nothing rather than falling back to "all".
  if (status !== undefined) params.set("status", status.join(","));
  return request(`/orders?${params.toString()}`);
}

export function fetchStaleOrderCount() {
  return request("/orders/stale-count");
}
