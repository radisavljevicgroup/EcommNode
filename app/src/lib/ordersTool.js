import { useEffect, useState } from "react";
import { fetchSettings } from "../api/settings";
import { retryable } from "./fetchWithRetry";

// Porudžbine is a built-in tool (see pages/alati/catalog.jsx, key "orders")
// like every other one in "Svi alati" — when a company switches it off, the
// Porudžbine nav pill disappears and #/porudzbine collapses to Početna.
// On by default (settings.ordersEnabled !== false) so existing companies
// keep the page they already use.
//
// App.jsx (nav + routing) and AlatiSection (the toggle) both need the same
// value, so it lives in this tiny module-level store: the toggle calls
// setOrdersToolEnabled() and every mounted useOrdersToolEnabled() re-renders.
const fetchSettingsWithRetry = retryable(fetchSettings);

let current = true;
const listeners = new Set();

export function setOrdersToolEnabled(enabled) {
  current = enabled;
  listeners.forEach((fn) => fn(enabled));
}

// `active` = only fetch once there's a signed-in user (App renders before
// auth resolves, and /settings requires auth).
export function useOrdersToolEnabled(active = true) {
  const [enabled, setEnabled] = useState(current);

  useEffect(() => {
    listeners.add(setEnabled);
    return () => listeners.delete(setEnabled);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    fetchSettingsWithRetry()
      .then((data) => {
        if (!cancelled) setOrdersToolEnabled(data.ordersEnabled !== false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  return enabled;
}
