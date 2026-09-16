const { createJsonFile } = require("./jsonFile");

const DEFAULT_SETTINGS = {
  staleOrderThresholdDays: 30,
  staleTrackingEnabled: true,
  unfiscalizedTrackingEnabled: true,
  // Which premium tools (identified by their toolCard.key) the user has
  // switched on — off by default. Today this is a manual toggle; later
  // it'll also be gated by an actual subscription/payment check.
  enabledPremiumTools: [],
  // How many of the most recent orders (across every connected site) the
  // "Interni nalozi" premium tool shows — see server/premium/eurocom.
  internalOrdersCount: 10,
  // "Personalizacija porudžbina" free tool (see app/src/pages/alati/catalog.jsx)
  // — off by default. personalizationProductIds are WooCommerce/Shopify
  // product IDs (as strings) that make the personalization icon/modal appear
  // on an order in Porudžbine when that order contains one of them.
  personalizationEnabled: false,
  personalizationProductIds: [],
};

// Keyed by company (see lib/auth.js) — each company gets its own settings
// instead of one shared global object every account read/wrote.
const file = createJsonFile("settings.json", {});
let byCompany = file.read();

function getSettings(company) {
  return { ...DEFAULT_SETTINGS, ...(byCompany[company] || {}) };
}

function updateSettings(company, patch) {
  const next = { ...getSettings(company), ...patch };
  byCompany = { ...byCompany, [company]: next };
  file.write(byCompany);
  return next;
}

function getStaleOrderThresholdDays(company) {
  return getSettings(company).staleOrderThresholdDays;
}

function isStaleTrackingEnabled(company) {
  return getSettings(company).staleTrackingEnabled !== false;
}

function isUnfiscalizedTrackingEnabled(company) {
  return getSettings(company).unfiscalizedTrackingEnabled !== false;
}

function isPersonalizationEnabled(company) {
  return getSettings(company).personalizationEnabled === true;
}

function getPersonalizationProductIds(company) {
  return getSettings(company).personalizationProductIds || [];
}

module.exports = {
  getSettings,
  updateSettings,
  getStaleOrderThresholdDays,
  isStaleTrackingEnabled,
  isUnfiscalizedTrackingEnabled,
  isPersonalizationEnabled,
  getPersonalizationProductIds,
};
