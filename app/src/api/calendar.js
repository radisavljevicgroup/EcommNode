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

export function fetchCalendarCategories() {
  return request("/calendar/categories");
}

export function createCalendarCategory(payload) {
  return request("/calendar/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCalendarCategory(id, payload) {
  return request(`/calendar/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCalendarCategory(id) {
  return request(`/calendar/categories/${id}`, { method: "DELETE" });
}

export function fetchCalendarEvents(from, to) {
  return request(`/calendar/events?from=${from}&to=${to}`);
}

export function createCalendarEvent(payload) {
  return request("/calendar/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCalendarEvent(id, payload) {
  return request(`/calendar/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCalendarEvent(id) {
  return request(`/calendar/events/${id}`, { method: "DELETE" });
}
