const { createJsonFile } = require("./jsonFile");

const DEFAULT_SETTINGS = { staleOrderThresholdDays: 30 };

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

module.exports = { getSettings, updateSettings, getStaleOrderThresholdDays };
