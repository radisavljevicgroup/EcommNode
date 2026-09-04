import { authHeaders } from "../lib/authHeaders";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export async function fetchFirma() {
  const res = await fetch(`${API_BASE}/firma`, { headers: await authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Došlo je do greške.");
  return data;
}

export async function updateFirma(payload) {
  const res = await fetch(`${API_BASE}/firma`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Došlo je do greške.");
  return data;
}
