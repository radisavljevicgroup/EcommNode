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

const file = createJsonFile("settings.json", DEFAULT_SETTINGS);
let settings = { ...DEFAULT_SETTINGS, ...file.read() };

function getSettings() {
  return settings;
}

function updateSettings(patch) {
  settings = { ...settings, ...patch };
  file.write(settings);
  return settings;
}

function getStaleOrderThresholdDays() {
  return settings.staleOrderThresholdDays;
}

function isStaleTrackingEnabled() {
  return settings.staleTrackingEnabled !== false;
}

function isUnfiscalizedTrackingEnabled() {
  return settings.unfiscalizedTrackingEnabled !== false;
}

module.exports = {
  getSettings,
  updateSettings,
  getStaleOrderThresholdDays,
  isStaleTrackingEnabled,
  isUnfiscalizedTrackingEnabled,
};
