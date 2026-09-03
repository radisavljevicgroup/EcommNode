const { createJsonFile } = require("./jsonFile");

const DEFAULT_SETTINGS = {
  staleOrderThresholdDays: 30,
  staleTrackingEnabled: true,
  unfiscalizedTrackingEnabled: true,
  // Which premium tools (identified by their toolCard.key) the user has
  // switched on — off by default. Today this is a manual toggle; later
  // it'll also be gated by an actual subscription/payment check.
  enabledPremiumTools: [],
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

module.exports = {
  getSettings,
  updateSettings,
  getStaleOrderThresholdDays,
  isStaleTrackingEnabled,
  isUnfiscalizedTrackingEnabled,
};
