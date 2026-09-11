// Loads the Facebook JavaScript SDK once and initializes it — used by the
// "Poveži se sa Facebook-om" flow (MetaPagesConnectModal.jsx) to open
// Meta's own login/permission popup via FB.login() instead of asking the
// merchant to paste a Page Access Token they'd have to dig out of Graph
// API Explorer themselves.
let loadPromise = null;

export function loadFacebookSdk() {
  if (loadPromise) return loadPromise;

  const appId = import.meta.env.VITE_META_APP_ID;
  if (!appId) {
    return Promise.reject(
      new Error("VITE_META_APP_ID nije podešen — nema kako da se otvori Facebook login.")
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    if (window.FB) {
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({ appId, version: "v18.0", xfbml: false });
      resolve(window.FB);
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Facebook SDK nije mogao da se učita."));
    document.body.appendChild(script);
  });

  return loadPromise;
}

// How long to wait for FB.login's callback before giving up — a Meta-side
// security checkpoint (e.g. a forced password change) shown inside the
// popup can break the SDK's own "popup was closed" polling, in which case
// the callback never fires at all and the caller would otherwise hang on
// this promise forever with no error and no way to retry.
const LOGIN_TIMEOUT_MS = 90_000;

// scope: comma-separated Meta permissions to request. Resolves with the
// short-lived USER access token from the popup, or rejects if the
// merchant closes the popup / declines / a checkpoint inside it stalls.
export async function facebookLogin(scope) {
  const FB = await loadFacebookSdk();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          "Facebook prijava nije završena na vreme (moguće da je zaglavljena na nekoj Facebook " +
            "sigurnosnoj proveri unutar popup-a) — zatvori popup ako je još otvoren i probaj ponovo."
        )
      );
    }, LOGIN_TIMEOUT_MS);

    FB.login(
      (response) => {
        clearTimeout(timeoutId);
        if (response.authResponse?.accessToken) {
          resolve(response.authResponse.accessToken);
        } else {
          // Surfaces Meta's own status (e.g. "not_authorized", "unknown")
          // in the visible error instead of a generic message — the only
          // diagnostic available without opening devtools.
          reject(new Error(`Prijava na Facebook je otkazana ili odbijena (status: ${response.status}).`));
        }
      },
      { scope }
    );
  });
}
