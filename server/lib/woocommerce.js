const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

function createWooClient({ siteUrl, consumerKey, consumerSecret }) {
  return new WooCommerceRestApi({
    url: siteUrl,
    consumerKey,
    consumerSecret,
    version: "wc/v3",
    queryStringAuth: true,
  });
}

module.exports = { createWooClient };
