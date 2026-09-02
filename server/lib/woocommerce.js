const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

// Without a timeout, a single slow/unresponsive page request to the live
// store hangs this call forever — which, inside the sync loop, means the
// whole sync never finishes: `syncing` stays true permanently, cached
// orders go stale, and there's no error to even show why.
const REQUEST_TIMEOUT_MS = 30000;

function createWooClient({ siteUrl, consumerKey, consumerSecret }) {
  return new WooCommerceRestApi({
    url: siteUrl,
    consumerKey,
    consumerSecret,
    version: "wc/v3",
    queryStringAuth: true,
    timeout: REQUEST_TIMEOUT_MS,
  });
}

module.exports = { createWooClient };
