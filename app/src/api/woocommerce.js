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

export function fetchWooOrders(connectionId) {
  const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
  return request(`/orders${query}`);
}
