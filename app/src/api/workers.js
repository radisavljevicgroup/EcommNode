import { authHeaders } from "../lib/authHeaders";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export async function fetchWorkers() {
  const res = await fetch(`${API_BASE}/workers`, { headers: await authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Došlo je do greške.");
  return data;
}

export async function addWorker(payload) {
  const res = await fetch(`${API_BASE}/workers`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Došlo je do greške.");
  return data;
}

export async function updateWorker(id, payload) {
  const res = await fetch(`${API_BASE}/workers/${id}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Došlo je do greške.");
  return data;
}
