const DEFAULT_RETRY_DELAYS_MS = [500, 1500, 3000];

// Wraps a one-shot async call (e.g. fetchFirma, fetchSettings) so a
// transient failure — dev server mid-restart, a dropped connection, any
// network blip — retries with backoff instead of the caller silently
// settling into a permanent default/error state for that page view (a
// `.catch(() => {})` that never runs again). Rejects with the last error
// once every attempt is exhausted.
export function retryable(fn, delays = DEFAULT_RETRY_DELAYS_MS) {
  function attempt(retriesLeft) {
    return fn().catch((err) => {
      if (retriesLeft <= 0) throw err;
      const delay = delays[delays.length - retriesLeft];
      return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
        attempt(retriesLeft - 1)
      );
    });
  }
  return () => attempt(delays.length);
}
