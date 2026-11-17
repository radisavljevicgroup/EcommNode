import { useEffect, useRef, useState } from "react";

// The server answers at once from what it has stored (orders cache, Meta /
// GA4 daily stores, report caches) and refreshes from the store/Meta/GA4 in
// the background. A response sent while that refresh still runs carries
// X-Data-Refreshing: 1 (server/lib/refreshTracker.js). The api/*.js request
// helpers pass every response to noteResponse; a few seconds later every
// page using useDataRefresh reloads its data quietly — no skeleton, no
// spinner — and shows what the refresh brought (a new order, today's spend).

const EVENT = "ecommnode:data-refreshed";
// A slow store / Meta (a year of missing days can take a minute) can still
// be refreshing when the quiet reload comes — that reload is marked again
// and schedules the next one, a bit later each time, and after the last
// delay it stops, so a refresh that never ends can't keep pages reloading.
const RELOAD_DELAYS_MS = [3000, 5000, 10000, 20000, 30000];
const CHAIN_RESET_MS = 90 * 1000;

let timer = null;
let reloadsInARow = 0;
let lastReloadAt = 0;

export function noteResponse(res) {
  if (res?.headers?.get("X-Data-Refreshing") !== "1") return;
  if (timer) return;
  if (Date.now() - lastReloadAt > CHAIN_RESET_MS) reloadsInARow = 0;
  if (reloadsInARow >= RELOAD_DELAYS_MS.length) return;
  timer = setTimeout(() => {
    timer = null;
    reloadsInARow += 1;
    lastReloadAt = Date.now();
    window.dispatchEvent(new Event(EVENT));
  }, RELOAD_DELAYS_MS[reloadsInARow]);
}

// const refresh = useDataRefresh();
// useEffect(() => {
//   const quiet = refresh.isQuiet();   // first line of the effect
//   if (!quiet) setLoading(true);
//   ...load, and on error: if (!quiet) setError(...)
// }, [...deps, refresh.tick]);
//
// isQuiet() is true when the run was started by a refresh tick (keep what's
// on screen while reloading), false for a normal load / filter change.
export function useDataRefresh() {
  const [tick, setTick] = useState(0);
  const seen = useRef({});

  useEffect(() => {
    const onRefreshed = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    window.addEventListener(EVENT, onRefreshed);
    return () => window.removeEventListener(EVENT, onRefreshed);
  }, []);

  // key: one per effect when a page has several effects on refresh.tick.
  const isQuiet = (key = "main") => {
    const quiet = tick !== (seen.current[key] ?? 0);
    seen.current[key] = tick;
    return quiet;
  };

  return { tick, isQuiet };
}
