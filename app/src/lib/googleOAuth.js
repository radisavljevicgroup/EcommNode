// "Poveži se sa Google nalogom" for GA4 and Search Console — same idea as
// facebookSdk.js's popup login, but Google's code<->token exchange needs a
// client secret, so the popup only ever sees the OAuth consent screen and
// a plain server-rendered "you can close this" page; the actual exchange
// happens server-side (server/routes/googleOAuth.js) and the result is
// relayed back to this window via postMessage.
import { authHeaders } from "./authHeaders";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const OAUTH_MESSAGE_SOURCE = "ecommnode-google-oauth";
const POPUP_POLL_MS = 500;
// Generous — the consent screen itself is quick, but a merchant picking
// the right Google account (or being prompted to sign in first) can take
// a while, and there's no good reason to cut that off aggressively.
const LOGIN_TIMEOUT_MS = 180_000;

// product: "ga4" | "gsc" — resolves with { pendingId, items, email } once
// the popup finishes; rejects if it's closed, denied, or times out.
export async function googleLogin(product) {
  const startRes = await fetch(`${API_BASE}/${product}/oauth/start`, {
    headers: await authHeaders(),
  });
  const startData = await startRes.json().catch(() => ({}));
  if (!startRes.ok) {
    throw new Error(startData.error || "Ne mogu da otvorim Google prijavu.");
  }

  const popup = window.open(
    startData.authUrl,
    "google-oauth",
    "width=480,height=640,menubar=no,toolbar=no,status=no"
  );
  if (!popup) {
    throw new Error("Browser je blokirao popup — dozvoli popup-e za ovaj sajt i probaj ponovo.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(closedCheck);
      clearTimeout(timeoutId);
    };

    const onMessage = (event) => {
      // The callback page (server/routes/googleOAuth.js) only ever runs
      // inside the popup this call opened — checking the message's source
      // window is a stronger guarantee than comparing event.origin, and
      // doesn't need this file to know the API's origin.
      if (event.source !== popup) return;
      const data = event.data;
      if (!data || data.source !== OAUTH_MESSAGE_SOURCE) return;
      if (data.product && data.product !== product) return;
      settled = true;
      cleanup();
      if (data.ok) {
        resolve(data);
      } else {
        reject(new Error(data.error || "Prijava na Google je otkazana ili odbijena."));
      }
    };

    // The popup closes itself right after posting its result — this only
    // fires as a fallback if the merchant closes it manually first.
    const closedCheck = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error("Prijava na Google je zatvorena pre nego što je završena."));
      }
    }, POPUP_POLL_MS);

    const timeoutId = setTimeout(() => {
      if (!settled) {
        cleanup();
        try {
          popup.close();
        } catch {
          // ignore — popup may already be gone
        }
        reject(new Error("Google prijava nije završena na vreme — probaj ponovo."));
      }
    }, LOGIN_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
  });
}
