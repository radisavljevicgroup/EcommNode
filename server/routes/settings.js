const { Router } = require("express");
const { getSettings, updateSettings } = require("../lib/settingsStore");

const router = Router();

router.get("/settings", (req, res) => {
  res.json(getSettings());
});

router.put("/settings", (req, res) => {
  const {
    staleOrderThresholdDays,
    staleTrackingEnabled,
    unfiscalizedTrackingEnabled,
    enabledPremiumTools,
  } = req.body || {};
  const patch = {};

  if (staleOrderThresholdDays !== undefined) {
    const n = Number(staleOrderThresholdDays);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: "Broj dana mora biti pozitivan broj." });
    }
    patch.staleOrderThresholdDays = n;
  }
  if (staleTrackingEnabled !== undefined) {
    patch.staleTrackingEnabled = Boolean(staleTrackingEnabled);
  }
  if (unfiscalizedTrackingEnabled !== undefined) {
    patch.unfiscalizedTrackingEnabled = Boolean(unfiscalizedTrackingEnabled);
  }
  if (enabledPremiumTools !== undefined) {
    if (
      !Array.isArray(enabledPremiumTools) ||
      !enabledPremiumTools.every((k) => typeof k === "string")
    ) {
      return res.status(400).json({ error: "enabledPremiumTools mora biti niz stringova." });
    }
    patch.enabledPremiumTools = enabledPremiumTools;
  }

  res.json(updateSettings(patch));
});

module.exports = router;
