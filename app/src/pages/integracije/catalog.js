// Add new integrations here — each entry gets a card in "Sve integracije"
// and, once connected, a row in "Moje integracije". GA4, GSC, Meta Ads,
// WooCommerce, Shopify and Eurocom have real connect flows and live outside
// this generic mock catalog (see IntegrationsSection.jsx).
export const INTEGRATION_CATALOG = [
  {
    key: "custom",
    name: "<CUSTOM SOLUTION/>",
    custom: true,
    desc: "Poveži sopstveno rešenje preko API-ja",
  },
];
