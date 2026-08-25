import shopifyLogo from "../../assets/shopify.png";
import googleAnalyticsLogo from "../../assets/google-analytics.png";
import googleSearchConsoleLogo from "../../assets/google-search-console.jpg";
import metaLogo from "../../assets/meta.jpg";

// Add new integrations here — each entry gets a card in "Sve integracije"
// and, once connected, a row in "Moje integracije".
export const INTEGRATION_CATALOG = [
  {
    key: "shopify",
    name: "Shopify",
    logo: shopifyLogo,
    desc: "Poveži svoju Shopify prodavnicu",
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    logo: googleAnalyticsLogo,
    desc: "Prati saobraćaj i konverzije na sajtu",
  },
  {
    key: "gsc",
    name: "Google Search Console",
    logo: googleSearchConsoleLogo,
    desc: "Prati performanse u Google pretrazi",
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
