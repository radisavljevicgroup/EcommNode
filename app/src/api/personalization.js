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

export function fetchPersonalizationFiles(connectionId, orderId) {
  return request(`/personalization/${connectionId}/${orderId}`);
}

// files: [{ fileName, dataUrl }] — dataUrl is a base64 data: URI, read
// client-side via FileReader.readAsDataURL (see PersonalizationModal).
export function uploadPersonalizationFiles(connectionId, orderId, productId, files) {
  return request(`/personalization/${connectionId}/${orderId}`, {
    method: "POST",
    body: JSON.stringify({ productId, files }),
  });
}

export function deletePersonalizationFile(connectionId, orderId, fileId) {
  return request(`/personalization/${connectionId}/${orderId}/${fileId}`, {
    method: "DELETE",
  });
}

export function markPersonalizationComplete(connectionId, orderId) {
  return request(`/personalization/${connectionId}/${orderId}/complete`, {
    method: "POST",
  });
}

export function unmarkPersonalizationComplete(connectionId, orderId) {
  return request(`/personalization/${connectionId}/${orderId}/complete`, {
    method: "DELETE",
  });
}

// [{ connectionId, orderId }] for every order marked izgravirano — lets
// Orders.jsx color the personalization icon green in the list without a
// per-order request.
export function fetchCompletedPersonalizationOrders() {
  return request("/personalization/completed");
}
