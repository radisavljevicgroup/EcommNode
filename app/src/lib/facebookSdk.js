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

// scope: comma-separated Meta permissions to request. Resolves with the
// short-lived USER access token from the popup, or rejects if the
// merchant closes the popup / declines.
export async function facebookLogin(scope) {
  const FB = await loadFacebookSdk();
  return new Promise((resolve, reject) => {
    FB.login(
      (response) => {
        if (response.authResponse?.accessToken) {
          resolve(response.authResponse.accessToken);
        } else {
          reject(new Error("Prijava na Facebook je otkazana ili odbijena."));
        }
      },
      { scope }
    );
  });
}
