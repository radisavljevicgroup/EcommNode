import shopifyLogo from "../../assets/shopify.png";
import metaLogo from "../../assets/meta.jpg";

// Add new integrations here — each entry gets a card in "Sve integracije"
// and, once connected, a row in "Moje integracije". GA4, GSC, WooCommerce
// and Eurocom have real connect flows and live outside this generic mock
// catalog (see IntegrationsSection.jsx).
export const INTEGRATION_CATALOG = [
  {
    key: "shopify",
    name: "Shopify",
    logo: shopifyLogo,
    desc: "Poveži svoju Shopify prodavnicu",
  },
  {
    key: "meta",
    name: "Meta",
    logo: metaLogo,
    desc: "Facebook i Instagram oglašavanje",
  },
  {
    key: "custom",
    name: "<CUSTOM SOLUTION/>",
    custom: true,
    desc: "Poveži sopstveno rešenje preko API-ja",
  },
];
