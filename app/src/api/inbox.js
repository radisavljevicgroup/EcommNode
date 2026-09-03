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

export function fetchConversations() {
  return request("/inbox/conversations");
}

export function fetchConversationMessages(conversationId) {
  return request(`/inbox/conversations/${conversationId}/messages`);
}

export function sendInboxMessage(conversationId, text) {
  return request(`/inbox/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function markConversationRead(conversationId) {
  return request(`/inbox/conversations/${conversationId}/read`, { method: "POST" });
}
