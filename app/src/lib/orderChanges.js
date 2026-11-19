import { authHeaders } from "./authHeaders";
import { clearApiCache } from "./apiCache";
import { triggerDataRefresh } from "./dataRefresh";

// New orders on an open page within seconds. WooCommerce pushes every new or
// changed order to the server the moment it happens (server/lib/
// orderWebhooks.js); this asks the server every few seconds "when did the
// orders last change?" — a tiny answer, no order data — and when that moves,
// drops the browser's API cache (lib/apiCache.js) and quietly reloads every
// page using useDataRefresh (Porudžbine, početna, badge-ovi...), so the new
// order shows without anyone pressing anything.
//
// Stores without webhooks (read-only API key, dev server): the same request
// makes the server check those stores (at most once a minute), and the
// moment that check finds something, the next tick here picks it up.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const POLL_MS = 5000;

let lastAt = null;
let busy = false;

async function check() {
  if (busy || document.visibilityState !== "visible") return;
  busy = true;
  try {
    const headers = await authHeaders();
    // Not signed in — nothing to watch.
    if (headers.Authorization === "Bearer ") return;
    const res = await fetch(`${API_BASE}/orders/last-change`, { headers });
    if (!res.ok) return;
    const { at } = await res.json();
    if (typeof at !== "number") return;
    if (lastAt !== null && at > lastAt) {
      clearApiCache();
      triggerDataRefresh();
    }
    lastAt = Math.max(lastAt ?? 0, at);
  } catch {
    // Offline / server restarting — try again next tick.
  } finally {
    busy = false;
  }
}

export function installOrderChangeWatcher() {
  if (window.__ecommnodeOrderWatcher) return;
  window.__ecommnodeOrderWatcher = true;
  setInterval(check, POLL_MS);
  // Coming back to the tab: check at once instead of waiting a tick.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  check();
}
